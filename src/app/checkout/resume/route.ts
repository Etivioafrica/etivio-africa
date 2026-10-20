import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrder, paystackCheckoutUrl, priceItems, type CartRef } from "@/lib/data/checkout";
import { accountIdByEmail } from "@/lib/data/guest";

// "Complete your purchase" in a reminder email. Paystack won't reuse a reference, so this starts a fresh order with
// the same buyer and items (at today's prices, minus anything they've since got) and goes straight to payment. The
// old order is closed, and the new one carries on its reminder count so nobody gets more than 4 emails.
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const reference = request.nextUrl.searchParams.get("order") ?? "";
  if (!/^ET[A-Z0-9]{8,40}$/.test(reference)) return to("/cart");
  const db = createAdminClient();
  const { data: old } = await db.from("orders").select("*").eq("reference", reference).maybeSingle();
  if (!old) return to("/cart");
  if (old.status === "success") return to(`/checkout/complete?order=${old.reference}`);

  const { data: rows } = await db.from("payments").select("course_id, product_id").eq("order_id", old.id);
  const refs: CartRef[] = (rows ?? []).map((r) => (r.course_id ? { type: "course" as const, id: r.course_id } : { type: "product" as const, id: r.product_id! }));
  const items = (await priceItems(refs, old.user_id ?? (await accountIdByEmail(old.email)))).filter((i) => !i.problem);
  if (!items.length) return to("/explore?payment=nothing-left");

  const billing = { firstName: old.first_name, lastName: old.last_name, email: old.email, phone: old.phone ?? "", country: old.country ?? "", state: old.state ?? "" };
  const order = await createOrder(old.user_id, billing, items);
  if (!order) return to("/cart?payment=error");
  await Promise.all([
    db.from("orders").update({ reminders_sent: old.reminders_sent, last_reminded_at: old.last_reminded_at }).eq("id", order.id),
    db.from("orders").update({ status: "failed", note: `Replaced by ${order.reference}`, reminders_sent: 4 }).eq("id", old.id).neq("status", "success"),
    db.from("payments").update({ status: "failed", note: `Replaced by ${order.reference}` }).eq("order_id", old.id).eq("status", "pending"),
  ]);
  const url = await paystackCheckoutUrl(order, billing, items.map((i) => i.title));
  return url ? NextResponse.redirect(url) : to("/cart?payment=error");
}
