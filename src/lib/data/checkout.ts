import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/roles";
import { grantProduct } from "./grants";
import { emailReceipt } from "@/lib/email/notify";
import type { VerifiedTransaction } from "@/lib/paystack";

// Checkout for paid courses and products. A payment row is created as "pending" before sending the buyer to
// Paystack; access is only granted once Paystack itself confirms the charge (callback or webhook, whichever is
// first), and the amount and currency match what we asked for.

export type CheckoutItem = { type: "course" | "product"; id: string; slug: string; title: string; priceMinor: number; currency: string; sellerId: string };

export async function checkoutItem(type: "course" | "product", slug: string): Promise<CheckoutItem | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const db = createAdminClient();
  if (type === "course") {
    const { data: c } = await db.from("courses").select("id, slug, title, price_minor, currency, status, instructor_id").eq("slug", slug).maybeSingle();
    return c && c.status === "published" ? { type, id: c.id, slug: c.slug, title: c.title, priceMinor: c.price_minor, currency: c.currency, sellerId: c.instructor_id } : null;
  }
  const { data: p } = await db.from("products").select("id, slug, title, price_minor, currency, status, creator_id").eq("slug", slug).maybeSingle();
  return p && p.status === "published" ? { type, id: p.id, slug: p.slug, title: p.title, priceMinor: p.price_minor, currency: p.currency, sellerId: p.creator_id } : null;
}

export async function alreadyOwns(userId: string, item: CheckoutItem) {
  const db = createAdminClient();
  const { data } =
    item.type === "course"
      ? await db.from("enrollments").select("user_id").eq("user_id", userId).eq("course_id", item.id).maybeSingle()
      : await db.from("product_access").select("user_id").eq("user_id", userId).eq("product_id", item.id).maybeSingle();
  return !!data;
}

// Tutors earn the price minus Etivio's commission. Items made by Etivio staff are all Etivio's.
async function split(item: CheckoutItem) {
  const db = createAdminClient();
  const [{ data: roles }, { data: settings }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", item.sellerId),
    db.from("platform_settings").select("commission_percent").maybeSingle(),
  ]);
  if (isStaff((roles ?? []).map((r) => r.role))) return { instructorId: null, share: 0, fee: item.priceMinor };
  const commission = Number(settings?.commission_percent ?? 20);
  const share = Math.floor((item.priceMinor * (100 - commission)) / 100);
  return { instructorId: item.sellerId, share, fee: item.priceMinor - share };
}

export async function createPendingPayment(userId: string, item: CheckoutItem) {
  const { instructorId, share, fee } = await split(item);
  const reference = `ET${randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;
  const { data, error } = await createAdminClient()
    .from("payments")
    .insert({
      user_id: userId,
      course_id: item.type === "course" ? item.id : null,
      product_id: item.type === "product" ? item.id : null,
      amount_minor: item.priceMinor,
      currency: item.currency,
      instructor_id: instructorId,
      instructor_share_minor: share,
      platform_fee_minor: fee,
      provider: "paystack",
      reference,
      status: "pending",
    })
    .select("id, reference")
    .single();
  return error || !data ? null : data;
}

// Marks a verified Paystack charge as paid and grants access. Safe to call more than once: only the first call
// that flips the payment from pending to success does anything.
export async function fulfillPayment(tx: VerifiedTransaction): Promise<{ ok: boolean; destination?: string; reason?: string }> {
  const db = createAdminClient();
  const { data: pay } = await db.from("payments").select("id, user_id, course_id, product_id, amount_minor, currency, status").eq("reference", tx.reference).maybeSingle();
  if (!pay) return { ok: false, reason: "unknown reference" };
  const destination = await destinationFor(pay.course_id, pay.product_id);
  if (pay.status === "success") return { ok: true, destination };
  if (tx.status !== "success") {
    // Only a definite failure closes it. "abandoned" or "ongoing" may still turn into a payment.
    if (tx.status === "failed") await db.from("payments").update({ status: "failed" }).eq("id", pay.id).eq("status", "pending");
    return { ok: false, reason: tx.status };
  }
  if (tx.amount !== pay.amount_minor || tx.currency !== pay.currency) {
    await db.from("payments").update({ status: "failed", note: `Amount mismatch: paid ${tx.amount} ${tx.currency}` }).eq("id", pay.id).eq("status", "pending");
    return { ok: false, reason: "amount mismatch" };
  }
  const { data: flipped } = await db
    .from("payments")
    .update({ status: "success", paid_at: tx.paid_at ?? new Date().toISOString() })
    .eq("id", pay.id)
    // A retry on Paystack's page can succeed after an earlier attempt was recorded as failed.
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (!flipped || !pay.user_id) return { ok: true, destination };

  if (pay.course_id) await db.from("enrollments").upsert({ user_id: pay.user_id, course_id: pay.course_id }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
  if (pay.product_id) await grantProduct(pay.user_id, pay.product_id, pay.id);
  after(() => emailReceipt(pay.id));
  return { ok: true, destination };
}

async function destinationFor(courseId: string | null, productId: string | null) {
  if (courseId) return `/learn/course/${courseId}?welcome=1`;
  if (productId) return "/learn/library?purchased=1";
  return "/learn";
}
