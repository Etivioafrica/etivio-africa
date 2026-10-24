import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/format";
import type { PickItem } from "./CouponForm";

// Published courses and products, for the "Chosen items" picker on the coupon form.
export async function pickableItems(): Promise<PickItem[]> {
  const db = createAdminClient();
  const [{ data: courses }, { data: products }] = await Promise.all([
    db.from("courses").select("id, title, price_minor, currency").eq("status", "published").order("title"),
    db.from("products").select("id, title, kind, price_minor, currency").eq("status", "published").order("title"),
  ]);
  return [
    ...(courses ?? []).map((c) => ({ id: c.id, title: c.title, type: "course" as const, meta: `Course · ${c.price_minor ? formatPrice(c.price_minor, c.currency) : "Free"}` })),
    ...(products ?? []).map((p) => ({ id: p.id, title: p.title, type: "product" as const, meta: `${p.kind.replace(/_/g, " ")} · ${p.price_minor ? formatPrice(p.price_minor, p.currency) : "Free"}` })),
  ];
}
