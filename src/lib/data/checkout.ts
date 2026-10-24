import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/roles";
import { grantProduct } from "./grants";
import { groupPaymentCleared } from "./group-buy";
import { sessionPaid } from "./coaching";
import { recordRedemption } from "./coupons";
import { emailGuestAccess, emailOrderReceipt } from "@/lib/email/notify";
import { accountForGuest, maskEmail } from "./guest";
import { initializeTransaction, type VerifiedTransaction } from "@/lib/paystack";
import { siteUrl } from "@/lib/email/site";

// Cart checkout. The buyer's items become one order with one Paystack payment; each item is also a row in payments
// (with its own commission split). Nothing is granted until Paystack itself confirms the charge (callback or
// webhook, whichever comes first) and the amount and currency match the order.

export type CartRef = { type: "course" | "product"; id: string };
export type PricedItem = CartRef & {
  slug: string;
  title: string;
  kind: string;
  priceMinor: number;
  currency: string;
  coverUrl: string | null;
  sellerId: string;
  href: string;
  // Why it can't be bought right now, if it can't.
  problem: "unavailable" | "free" | "owned" | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_CART = 20;

// Current price and availability for each cart item, read fresh from the database (the browser's copy of the cart
// is only a list of ids). `ownerId` marks items that account already has.
export async function priceItems(refs: CartRef[], ownerId: string | null): Promise<PricedItem[]> {
  const seen = new Set<string>();
  const clean = refs
    .filter((r) => (r.type === "course" || r.type === "product") && UUID.test(r.id))
    .filter((r) => !seen.has(`${r.type}:${r.id}`) && !!seen.add(`${r.type}:${r.id}`))
    .slice(0, MAX_CART);
  const courseIds = clean.filter((r) => r.type === "course").map((r) => r.id);
  const productIds = clean.filter((r) => r.type === "product").map((r) => r.id);
  const db = createAdminClient();
  const [{ data: courses }, { data: products }, { data: enrolled }, { data: owned }] = await Promise.all([
    courseIds.length ? db.from("courses").select("id, slug, title, price_minor, currency, status, cover_url, instructor_id").in("id", courseIds) : Promise.resolve({ data: [] }),
    productIds.length ? db.from("products").select("id, slug, title, kind, price_minor, currency, status, cover_url, creator_id").in("id", productIds) : Promise.resolve({ data: [] }),
    ownerId && courseIds.length ? db.from("enrollments").select("course_id").eq("user_id", ownerId).in("course_id", courseIds) : Promise.resolve({ data: [] }),
    ownerId && productIds.length ? db.from("product_access").select("product_id").eq("user_id", ownerId).in("product_id", productIds) : Promise.resolve({ data: [] }),
  ]);
  const ownedSet = new Set([...(enrolled ?? []).map((e) => `course:${e.course_id}`), ...(owned ?? []).map((o) => `product:${o.product_id}`)]);
  return clean.map((r): PricedItem => {
    const isCourse = r.type === "course";
    const c = isCourse ? (courses ?? []).find((x) => x.id === r.id) : null;
    const p = isCourse ? null : (products ?? []).find((x) => x.id === r.id);
    const row = c ?? p;
    if (!row) return { ...r, slug: "", title: "This item is no longer available", kind: r.type, priceMinor: 0, currency: "NGN", coverUrl: null, sellerId: "", href: "/explore", problem: "unavailable" };
    return {
      ...r,
      slug: row.slug,
      title: row.title,
      kind: p ? p.kind : "course",
      priceMinor: row.price_minor,
      currency: row.currency,
      coverUrl: row.cover_url,
      sellerId: c ? c.instructor_id : p!.creator_id,
      href: isCourse ? `/courses/${row.slug}` : `/products/${row.slug}`,
      problem: row.status !== "published" ? "unavailable" : row.price_minor <= 0 ? "free" : ownedSet.has(`${r.type}:${r.id}`) ? "owned" : null,
    };
  });
}

// Tutors earn the price minus Etivio's commission. Items made by Etivio staff are all Etivio's.
async function splits(items: PricedItem[]) {
  const db = createAdminClient();
  const sellers = [...new Set(items.map((i) => i.sellerId).filter(Boolean))];
  const [{ data: roles }, { data: settings }] = await Promise.all([
    sellers.length ? db.from("user_roles").select("user_id, role").in("user_id", sellers) : Promise.resolve({ data: [] }),
    db.from("platform_settings").select("commission_percent").maybeSingle(),
  ]);
  const commission = Number(settings?.commission_percent ?? 20);
  return items.map((item) => {
    const theirRoles = (roles ?? []).filter((r) => r.user_id === item.sellerId).map((r) => r.role);
    if (isStaff(theirRoles)) return { instructorId: null, share: 0, fee: item.priceMinor };
    const share = Math.floor((item.priceMinor * (100 - commission)) / 100);
    return { instructorId: item.sellerId, share, fee: item.priceMinor - share };
  });
}

export type Billing = { firstName: string; lastName: string; email: string; phone: string; country: string; state: string };

// Records a pending order and one pending payment row per item. Items must already be checked (no `problem`).
// `coupon` takes its per-item discounts off first (each item is recorded at what the buyer pays for it, and the
// tutor split is on that). `walletMinor` is paid from the buyer's wallet (taken when the order completes); Paystack
// charges the rest.
export async function createOrder(
  userId: string | null,
  billing: Billing,
  items: PricedItem[],
  { groupBuyId = null, walletMinor = 0, coupon = null }: { groupBuyId?: string | null; walletMinor?: number; coupon?: { id: string; discounts: number[] } | null } = {},
) {
  const db = createAdminClient();
  const reference = `ET${randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;
  const discounts = items.map((_, i) => coupon?.discounts[i] ?? 0);
  const paid = items.map((item, i) => ({ ...item, priceMinor: item.priceMinor - discounts[i] }));
  const discountMinor = discounts.reduce((n, d) => n + d, 0);
  const total = paid.reduce((n, i) => n + i.priceMinor, 0) - walletMinor;
  const { data: order, error } = await db
    .from("orders")
    .insert({
      reference,
      user_id: userId,
      email: billing.email,
      first_name: billing.firstName,
      last_name: billing.lastName,
      phone: billing.phone || null,
      country: billing.country || null,
      state: billing.state || null,
      total_minor: total,
      currency: items[0]?.currency ?? "NGN",
      group_buy_id: groupBuyId,
      wallet_minor: walletMinor,
      coupon_id: coupon && discountMinor > 0 ? coupon.id : null,
      discount_minor: discountMinor,
    })
    .select("id, reference, total_minor, currency")
    .single();
  if (error || !order) return null;
  const parts = await splits(paid);
  const { error: itemsError } = await db.from("payments").insert(
    paid.map((item, i) => ({
      order_id: order.id,
      user_id: userId,
      course_id: item.type === "course" ? item.id : null,
      product_id: item.type === "product" ? item.id : null,
      amount_minor: item.priceMinor,
      discount_minor: discounts[i],
      currency: item.currency,
      instructor_id: parts[i].instructorId,
      instructor_share_minor: parts[i].share,
      platform_fee_minor: parts[i].fee,
      provider: "paystack",
      reference: `${reference}-${i + 1}`,
      status: "pending" as const,
    })),
  );
  if (itemsError) {
    await db.from("orders").delete().eq("id", order.id);
    return null;
  }
  return order;
}

// Marks a verified Paystack charge as paid and grants every item. Safe to call more than once: only the call that
// flips the order from pending (or failed) to success does anything.
export async function fulfillOrder(tx: VerifiedTransaction): Promise<{ ok: boolean; destination?: string; reason?: string }> {
  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("reference", tx.reference)
    .maybeSingle();
  if (!order) return { ok: false, reason: "unknown reference" };
  // Guests aren't signed in when they come back from Paystack, so the page tells them which inbox to check.
  const destination =
    order.purpose === "wallet_topup" ? "/learn/wallet?topup=done" : order.purpose === "coach_booking" ? "/learn/sessions?booked=1" : `/checkout/complete?order=${order.reference}${order.user_id ? "" : `&email=${encodeURIComponent(maskEmail(order.email))}`}`;
  if (order.status === "success") return { ok: true, destination };
  if (tx.status !== "success") {
    // Only a definite failure closes it. "abandoned" or "ongoing" may still turn into a payment.
    if (tx.status === "failed") {
      await db.from("orders").update({ status: "failed" }).eq("id", order.id).eq("status", "pending");
      await db.from("payments").update({ status: "failed" }).eq("order_id", order.id).eq("status", "pending");
    }
    return { ok: false, reason: tx.status, ...(order.purpose === "wallet_topup" ? { destination: "/learn/wallet?topup=failed" } : {}) };
  }
  if (tx.amount !== order.total_minor || tx.currency !== order.currency) {
    const note = `Amount mismatch: paid ${tx.amount} ${tx.currency}`;
    await db.from("orders").update({ status: "failed", note }).eq("id", order.id).eq("status", "pending");
    await db.from("payments").update({ status: "failed", note }).eq("order_id", order.id).eq("status", "pending");
    return { ok: false, reason: "amount mismatch" };
  }
  return completeOrder(order, tx.paid_at ?? new Date().toISOString(), destination);
}

const ORDER_COLUMNS = "id, reference, user_id, email, first_name, last_name, total_minor, currency, status, group_buy_id, wallet_minor, purpose, coupon_id, discount_minor";
type OrderRow = { id: string; reference: string; user_id: string | null; email: string; first_name: string; last_name: string; status: string; total_minor: number; currency: string; group_buy_id: string | null; wallet_minor: number; purpose: string; coupon_id: string | null; discount_minor: number };

// Orders with nothing left to charge (the wallet and/or a coupon cover it all): nothing goes to Paystack, the order
// completes straight away. Guests can get here with a 100% coupon; their account is made in completeOrder.
export async function completeFreeOrder(orderId: string) {
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  if (!order || order.total_minor !== 0 || (order.wallet_minor > 0 && !order.user_id)) return { ok: false as const };
  const ok = order.wallet_minor > 0 ? await db.rpc("spend_wallet", { p_user: order.user_id!, p_amount: order.wallet_minor, p_order: order.id }) : { data: true };
  if (!ok.data) {
    await db.from("orders").update({ status: "failed", note: "Wallet balance too low when completing" }).eq("id", order.id).eq("status", "pending");
    return { ok: false as const };
  }
  return completeOrder(order, new Date().toISOString(), `/checkout/complete?order=${order.reference}${order.user_id ? "" : `&email=${encodeURIComponent(maskEmail(order.email))}`}`);
}

// Marks the order paid and grants every item (or adds the buyer to their group). Only the call that flips the order
// from pending (or failed) to success does anything.
async function completeOrder(order: OrderRow, paidAt: string, destination: string): Promise<{ ok: boolean; destination?: string; reason?: string }> {
  const db = createAdminClient();
  const { data: flipped } = await db
    .from("orders")
    .update({ status: "success", paid_at: paidAt })
    .eq("id", order.id)
    // A retry on Paystack's page can succeed after an earlier attempt was recorded as failed.
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (!flipped) return { ok: true, destination };

  // Wallet top-up: credit the wallet and stop (no items, no receipt for a course).
  if (order.purpose === "wallet_topup") {
    if (order.user_id) await db.from("wallet_transactions").insert({ user_id: order.user_id, amount_minor: order.total_minor, currency: order.currency, kind: "topup", order_id: order.id, note: "Added with Paystack" });
    return { ok: true, destination };
  }

  // Coaching session: confirm it (or credit the wallet if the time was lost) and stop.
  if (order.purpose === "coach_booking") {
    await sessionPaid(order.id, paidAt);
    return { ok: true, destination };
  }

  // Guests: find or create their account now that the money is confirmed.
  let userId = order.user_id;
  let tempPassword: string | null = null;
  if (!userId) {
    const account = await accountForGuest(order.email, `${order.first_name} ${order.last_name}`.trim());
    if (!account) {
      await db.from("orders").update({ note: "Paid, but the buyer's account could not be created. Grant access by hand." }).eq("id", order.id);
      return { ok: true, destination };
    }
    userId = account.userId;
    tempPassword = account.password;
    await db.from("orders").update({ user_id: userId }).eq("id", order.id);
  }

  if (order.coupon_id) await recordRedemption({ ...order, user_id: userId });

  // Paystack charged the rest; take the wallet part now (orders with nothing to charge already took it).
  if (order.wallet_minor > 0 && order.total_minor > 0 && order.status !== "success") {
    const { data: spent } = await db.rpc("spend_wallet", { p_user: userId, p_amount: order.wallet_minor, p_order: order.id });
    if (!spent) await db.from("orders").update({ note: "Wallet balance was too low to cover its part when the payment cleared. Check before refunding." }).eq("id", order.id);
  }

  const { data: items } = await db
    .from("payments")
    .update({ status: "success", paid_at: paidAt, user_id: userId })
    .eq("order_id", order.id)
    .select("id, course_id, product_id");
  for (const item of items ?? []) {
    if (item.course_id && order.group_buy_id) await groupPaymentCleared(order.group_buy_id, userId, order.id);
    else if (item.course_id) await db.from("enrollments").upsert({ user_id: userId, course_id: item.course_id }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
    if (item.product_id) await grantProduct(userId, item.product_id, item.id);
  }
  after(() => emailOrderReceipt(order.id));
  // New accounts get their login details; buyers who already had an account just sign in as usual.
  if (tempPassword) {
    const password = tempPassword;
    after(() => emailGuestAccess(order.id, password));
  }
  return { ok: true, destination };
}

// Opens Paystack's checkout for an order. Cancelling there brings the buyer back through /checkout/cancelled,
// which sends the first reminder straight away.
export async function paystackCheckoutUrl(order: { id: string; reference: string; total_minor: number; currency: string }, billing: Billing, titles: string[]) {
  const site = siteUrl();
  const init = await initializeTransaction({
    email: billing.email,
    amountMinor: order.total_minor,
    currency: order.currency,
    reference: order.reference,
    callbackUrl: `${site}/api/paystack/callback`,
    metadata: {
      order_id: order.id,
      cancel_action: `${site}/checkout/cancelled?order=${order.reference}`,
      custom_fields: [
        { display_name: "Name", variable_name: "name", value: `${billing.firstName} ${billing.lastName}`.trim() },
        { display_name: "Phone", variable_name: "phone", value: billing.phone },
        { display_name: "Items", variable_name: "items", value: titles.join(", ").slice(0, 250) },
      ],
    },
  });
  return init.status && init.data ? init.data.authorization_url : null;
}

// A wallet top-up: an order with no items for the amount the person wants to add. Signed-in buyers only.
export async function createTopupOrder(userId: string, billing: Billing, amountMinor: number) {
  const reference = `ET${randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;
  const { data } = await createAdminClient()
    .from("orders")
    .insert({ reference, user_id: userId, email: billing.email, first_name: billing.firstName, last_name: billing.lastName, total_minor: amountMinor, currency: "NGN", purpose: "wallet_topup" })
    .select("id, reference, total_minor, currency")
    .single();
  return data;
}
