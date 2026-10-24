"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { completeFreeOrder, createOrder, paystackCheckoutUrl, priceItems, type Billing, type CartRef, type PricedItem } from "@/lib/data/checkout";
import { accountIdByEmail, isEmail } from "@/lib/data/guest";
import { paystackReady } from "@/lib/paystack";
import { walletBalance } from "@/lib/data/wallet";
import { evaluateCoupon } from "@/lib/data/coupons";

// Cart page and checkout summary: current prices and whether each item can still be bought by this visitor.
export async function priceCart(refs: CartRef[]): Promise<PricedItem[]> {
  const viewer = await sessionUser(await createClient());
  return priceItems(Array.isArray(refs) ? refs : [], viewer?.id ?? null);
}

export type CouponPreview = { ok: true; code: string; label: string; discountMinor: number; discounts: Record<string, number> } | { ok: false; error: string };

// "Apply" on the coupon field: what the code takes off this cart, item by item (keyed "type:id").
export async function previewCoupon(code: string, refs: CartRef[], typedEmail: string): Promise<CouponPreview> {
  const viewer = await sessionUser(await createClient());
  const email = viewer?.email || String(typedEmail ?? "").trim().toLowerCase().slice(0, 200);
  const ownerId = viewer?.id ?? (isEmail(email) ? await accountIdByEmail(email) : null);
  const items = await priceItems(Array.isArray(refs) ? refs : [], ownerId);
  const res = await evaluateCoupon(String(code ?? "").slice(0, 40), items, { userId: ownerId, email: isEmail(email) ? email : null });
  if (!res.ok) return res;
  const discounts: Record<string, number> = {};
  items.forEach((i, n) => {
    if (res.discounts[n]) discounts[`${i.type}:${i.id}`] = res.discounts[n];
  });
  return { ok: true, code: res.coupon.code, label: res.label, discountMinor: res.discountMinor, discounts };
}

export type PlaceOrderState = { error?: string; drop?: string[]; couponError?: boolean } | null;
const str = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? "").trim().slice(0, max);

// "Pay now" on the checkout page: checks the items and billing details, records the order and opens Paystack.
// Guests get an account after payment; signed-in buyers pay with their account email.
export async function placeOrder(_prev: PlaceOrderState, fd: FormData): Promise<PlaceOrderState> {
  let refs: CartRef[] = [];
  try {
    refs = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {}
  const viewer = await sessionUser(await createClient());
  const billing: Billing = {
    firstName: str(fd, "first_name", 60),
    lastName: str(fd, "last_name", 60),
    email: viewer?.email || str(fd, "email", 200).toLowerCase(),
    phone: str(fd, "phone", 30),
    country: str(fd, "country", 60),
    state: str(fd, "state", 60),
  };
  if (!billing.firstName || !billing.lastName) return { error: "Please enter your first and last name." };
  if (!isEmail(billing.email)) return { error: "Please enter a valid email. Your receipt and login details go there." };
  if (!/^[+\d][\d\s()-]{6,}$/.test(billing.phone)) return { error: "Please enter a valid phone number." };
  if (!billing.country) return { error: "Please choose your country." };

  // A guest using an email that already has an account: their purchase joins that account, so skip what it owns.
  const ownerId = viewer?.id ?? (await accountIdByEmail(billing.email));
  const items = await priceItems(refs, ownerId);
  if (!items.length) return { error: "Your cart is empty." };
  const blocked = items.filter((i) => i.problem);
  if (blocked.length)
    return {
      error: blocked.some((i) => i.problem === "owned")
        ? `${viewer ? "You already have" : "That email already has"} ${blocked.map((i) => `"${i.title}"`).join(", ")}. We've taken ${blocked.length === 1 ? "it" : "them"} out of your cart.`
        : "Some items are no longer available, so we've taken them out of your cart.",
      drop: blocked.map((i) => `${i.type}:${i.id}`),
    };
  if (new Set(items.map((i) => i.currency)).size > 1) return { error: "Items in different currencies need separate orders." };

  // A coupon is checked again now: it may have run out or expired since it was applied.
  const code = str(fd, "coupon", 40);
  let coupon: { id: string; discounts: number[] } | null = null;
  if (code) {
    const res = await evaluateCoupon(code, items, { userId: ownerId, email: billing.email });
    if (!res.ok) return { error: `Coupon ${code.toUpperCase()}: ${res.error} Remove it to pay the full price.`, couponError: true };
    coupon = { id: res.coupon.id, discounts: res.discounts };
  }

  // Signed-in buyers spend their wallet first; if the wallet and coupon cover everything, Paystack isn't needed.
  const total = items.reduce((n, i) => n + i.priceMinor, 0) - (coupon?.discounts.reduce((n, d) => n + d, 0) ?? 0);
  const wallet = viewer ? Math.min(await walletBalance(viewer.id), total) : 0;
  if (wallet < total && !paystackReady()) return { error: "Payments aren't available right now. Please try again later." };
  const order = await createOrder(viewer?.id ?? null, billing, items, { walletMinor: wallet, coupon });
  if (!order) return { error: "We couldn't start your order. Please try again." };
  if (order.total_minor === 0) {
    const done = await completeFreeOrder(order.id);
    if (!done.ok || !done.destination) return { error: wallet > 0 ? "We couldn't use your wallet just now. Please try again." : "We couldn't complete your order. Please try again." };
    redirect(done.destination);
  }
  const url = await paystackCheckoutUrl(order, billing, items.map((i) => i.title));
  if (!url) return { error: "We couldn't reach the payment provider. Please try again." };
  redirect(url);
}
