import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
import type { PricedItem } from "./checkout";

// Coupons (migration 0045): discount codes made in Admin › Coupons. A code is checked against the priced cart here,
// both when the buyer applies it and again when they pay, and the discount is split across the items it covers.
// A use is only recorded (coupon_redemptions) when the payment clears.

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "fixed";
  value: number;
  currency: string;
  applies_to: "all" | "courses" | "products" | "selected";
  course_ids: string[];
  product_ids: string[];
  emails: string[];
  max_uses: number | null;
  per_person: number | null;
  min_order_minor: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

export type CouponResult =
  | { ok: true; coupon: CouponRow; discounts: number[]; discountMinor: number; label: string }
  | { ok: false; error: string };

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

export function couponLabel(c: Pick<CouponRow, "kind" | "value" | "currency">) {
  return c.kind === "percent" ? `${c.value}% off` : `${formatMoney(c.value, c.currency)} off`;
}

const covers = (c: CouponRow, item: PricedItem) =>
  c.applies_to === "all" ||
  (c.applies_to === "courses" && item.type === "course") ||
  (c.applies_to === "products" && item.type === "product") ||
  (c.applies_to === "selected" && (item.type === "course" ? c.course_ids : c.product_ids).includes(item.id));

// Where a coupon stands right now, for the status pill.
export function couponState(c: Pick<CouponRow, "active" | "starts_at" | "ends_at" | "max_uses">, uses: number) {
  const now = Date.now();
  if (!c.active) return { key: "closed", label: "Off" };
  if (c.ends_at && Date.parse(c.ends_at) < now) return { key: "archived", label: "Expired" };
  if (c.max_uses && uses >= c.max_uses) return { key: "archived", label: "Used up" };
  if (c.starts_at && Date.parse(c.starts_at) > now) return { key: "pending", label: "Scheduled" };
  return { key: "published", label: "Active" };
}

// Checks `code` for this buyer and cart. `email` is the buyer's email (signed in, or typed at checkout); it's needed
// for coupons kept to certain people and for the per-person limit.
export async function evaluateCoupon(code: string, items: PricedItem[], buyer: { userId: string | null; email: string | null }): Promise<CouponResult> {
  const clean = normalizeCode(code);
  if (!clean) return { ok: false, error: "Enter a coupon code." };
  const db = createAdminClient();
  const { data } = await db.from("coupons").select("*").eq("code", clean).maybeSingle();
  const coupon = data as CouponRow | null;
  const now = Date.now();
  if (!coupon || !coupon.active) return { ok: false, error: "That coupon code isn't valid." };
  if (coupon.starts_at && Date.parse(coupon.starts_at) > now) return { ok: false, error: "That coupon isn't active yet." };
  if (coupon.ends_at && Date.parse(coupon.ends_at) < now) return { ok: false, error: "That coupon has expired." };

  const email = buyer.email?.trim().toLowerCase() || null;
  if (coupon.emails.length) {
    if (!email) return { ok: false, error: "This coupon is for specific people. Enter your email first, then apply it." };
    if (!coupon.emails.includes(email)) return { ok: false, error: "This coupon isn't available for your account." };
  }

  const payable = items.filter((i) => !i.problem);
  const covered = payable.map((i) => covers(coupon, i) && i.currency === coupon.currency);
  if (!covered.some(Boolean)) return { ok: false, error: "This coupon doesn't apply to anything in your cart." };
  const subtotal = payable.reduce((n, i) => n + i.priceMinor, 0);
  if (subtotal < coupon.min_order_minor) return { ok: false, error: `This coupon needs an order of at least ${formatMoney(coupon.min_order_minor, coupon.currency)}.` };

  if (coupon.max_uses || (coupon.per_person && (email || buyer.userId))) {
    const { data: uses } = await db.from("coupon_redemptions").select("user_id, email").eq("coupon_id", coupon.id);
    if (coupon.max_uses && (uses?.length ?? 0) >= coupon.max_uses) return { ok: false, error: "This coupon has been used up." };
    const mine = (uses ?? []).filter((u) => (buyer.userId && u.user_id === buyer.userId) || (email && u.email === email)).length;
    if (coupon.per_person && mine >= coupon.per_person) return { ok: false, error: "You've already used this coupon." };
  }

  // Discount per item, in the same order as `items` (0 for items it doesn't cover).
  const discounts = items.map(() => 0);
  const idx = items.map((i, n) => (!i.problem && covers(coupon, i) && i.currency === coupon.currency ? n : -1)).filter((n) => n >= 0);
  if (coupon.kind === "percent") {
    for (const n of idx) discounts[n] = Math.floor((items[n].priceMinor * coupon.value) / 100);
  } else {
    // A fixed amount is shared across the covered items in proportion to their price, never more than they cost.
    const base = idx.reduce((s, n) => s + items[n].priceMinor, 0);
    const off = Math.min(coupon.value, base);
    let given = 0;
    idx.forEach((n, k) => {
      const share = k === idx.length - 1 ? off - given : Math.floor((off * items[n].priceMinor) / base);
      discounts[n] = share;
      given += share;
    });
  }
  const discountMinor = discounts.reduce((s, d) => s + d, 0);
  if (discountMinor <= 0) return { ok: false, error: "This coupon doesn't take anything off this order." };
  return { ok: true, coupon, discounts, discountMinor, label: couponLabel(coupon) };
}

// Called once an order using a coupon is paid. The unique order_id makes a repeat call harmless.
export async function recordRedemption(order: { id: string; coupon_id: string | null; discount_minor: number; user_id: string | null; email: string }) {
  if (!order.coupon_id) return;
  await createAdminClient()
    .from("coupon_redemptions")
    .upsert(
      { coupon_id: order.coupon_id, order_id: order.id, user_id: order.user_id, email: order.email.toLowerCase(), discount_minor: order.discount_minor },
      { onConflict: "order_id", ignoreDuplicates: true },
    );
}
