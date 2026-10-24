"use server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { audit, requireAdmin } from "@/lib/admin";
import { normalizeCode } from "@/lib/data/coupons";
import { nairaToMinor } from "@/lib/format";
import type { FormState } from "@/app/(app)/teach/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (fd: FormData, key: string, max = 200) => String(fd.get(key) ?? "").trim().slice(0, max);
const ids = (fd: FormData, key: string) => [...new Set(fd.getAll(key).map(String).filter((v) => UUID.test(v)))];
const whole = (v: string) => (v === "" ? null : Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : NaN);
// datetime-local values are Lagos time (Etivio's admins are in Nigeria).
const when = (v: string) => (v ? new Date(`${v}:00+01:00`).toISOString() : null);

// Create (no id) or update a coupon from the coupon form.
export async function saveCoupon(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("coupons");
  const id = str(fd, "id", 40);
  const code = normalizeCode(str(fd, "code", 40));
  const kind = fd.get("kind") === "fixed" ? "fixed" : "percent";
  const appliesTo = (["all", "courses", "products", "selected"] as const).find((v) => v === fd.get("applies_to")) ?? "all";
  const forSome = fd.get("audience") === "people";
  const emails = forSome ? [...new Set(str(fd, "emails", 20000).toLowerCase().split(/[\s,;]+/).filter(Boolean))] : [];
  const courseIds = appliesTo === "selected" ? ids(fd, "course_ids") : [];
  const productIds = appliesTo === "selected" ? ids(fd, "product_ids") : [];
  const value = kind === "percent" ? Number(str(fd, "value", 10)) : nairaToMinor(str(fd, "value", 20));
  const maxUses = whole(str(fd, "max_uses", 10));
  const perPerson = whole(str(fd, "per_person", 10));
  const minOrder = str(fd, "min_order", 20) ? nairaToMinor(str(fd, "min_order", 20)) : 0;
  const startsAt = when(str(fd, "starts_at", 20));
  const endsAt = when(str(fd, "ends_at", 20));

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return { error: "Codes are 3 to 32 letters, numbers, dashes or underscores." };
  if (kind === "percent" && !(Number.isInteger(value) && value >= 1 && value <= 100)) return { error: "A percent discount is a whole number from 1 to 100." };
  if (kind === "fixed" && !(value > 0)) return { error: "Enter the amount to take off, in naira." };
  if (appliesTo === "selected" && !courseIds.length && !productIds.length) return { error: "Pick at least one course or product, or choose another option under Applies to." };
  if (forSome && !emails.length) return { error: "Add the email of at least one person, or set it to Anyone." };
  const bad = emails.find((e) => !EMAIL.test(e));
  if (bad) return { error: `"${bad}" isn't a valid email.` };
  if (emails.length > 2000) return { error: "That's too many people for one coupon (2,000 at most)." };
  if (Number.isNaN(maxUses) || Number.isNaN(perPerson)) return { error: "Use limits are whole numbers. Leave them empty for no limit." };
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "The end date must be after the start date." };

  const row = {
    code,
    description: str(fd, "description", 300) || null,
    kind,
    value,
    applies_to: appliesTo,
    course_ids: courseIds,
    product_ids: productIds,
    emails,
    max_uses: maxUses,
    per_person: perPerson,
    min_order_minor: minOrder,
    starts_at: startsAt,
    ends_at: endsAt,
    active: fd.get("active") === "on",
    updated_at: new Date().toISOString(),
  };
  const res = id ? await db.from("coupons").update(row).eq("id", id).select("id").single() : await db.from("coupons").insert({ ...row, created_by: admin.id }).select("id").single();
  if (res.error) return { error: res.error.code === "23505" ? `There's already a coupon called ${code}.` : "Couldn't save the coupon." };
  await audit(admin.id, id ? "coupon.update" : "coupon.create", { type: "coupon", id: res.data.id }, { code, kind, value });
  if (!id) redirect(`/admin/coupons/${res.data.id}?created=1`);
  refresh();
  return { ok: "Coupon saved." };
}

export async function setCouponActive(id: string, active: boolean) {
  const { admin, db } = await requireAdmin("coupons");
  await db.from("coupons").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  await audit(admin.id, active ? "coupon.on" : "coupon.off", { type: "coupon", id });
  refresh();
}

// Coupons nobody has used can be deleted. Used ones stay (orders point at them) and are switched off instead.
export async function deleteCoupon(id: string): Promise<{ error?: string }> {
  const { admin, db } = await requireAdmin("coupons");
  const { count } = await db.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", id);
  if (count) return { error: "This coupon has been used, so it stays for your records. Switch it off instead." };
  const { error } = await db.from("coupons").delete().eq("id", id);
  if (error) return { error: "Couldn't delete the coupon." };
  await audit(admin.id, "coupon.delete", { type: "coupon", id });
  redirect("/admin/coupons");
}
