"use server";
import { refresh } from "next/cache";
import { audit, requireSuperAdmin } from "@/lib/admin";
import { nairaToMinor } from "@/lib/format";
import type { FormState } from "@/app/(app)/teach/actions";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// Manual / offline payment (bank transfer etc.): records the sale with the current split and enrolls the buyer.
export async function recordPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireSuperAdmin();
  const email = str(fd, "email").toLowerCase();
  const courseId = str(fd, "course_id");
  if (!email || !courseId) return { error: "Enter the buyer's email and pick a course." };

  const { data: matches } = await db.rpc("admin_list_users", { p_search: email, p_limit: 5 });
  const buyer = (matches ?? []).find((u) => u.email.toLowerCase() === email);
  if (!buyer) return { error: "No Etivio account uses that email." };

  const [{ data: course }, { data: settings }] = await Promise.all([
    db.from("courses").select("id, title, instructor_id, price_minor, currency").eq("id", courseId).single(),
    db.from("platform_settings").select("commission_percent").single(),
  ]);
  if (!course) return { error: "Course not found." };
  const amount = str(fd, "amount") ? nairaToMinor(str(fd, "amount")) : course.price_minor;
  if (amount <= 0) return { error: "Enter an amount above zero." };
  const fee = Math.round((amount * Number(settings?.commission_percent ?? 20)) / 100);

  const reference = str(fd, "reference") || `MAN-${Date.now().toString(36).toUpperCase()}`;
  const { error } = await db.from("payments").insert({
    user_id: buyer.id,
    course_id: course.id,
    instructor_id: course.instructor_id,
    amount_minor: amount,
    currency: course.currency,
    platform_fee_minor: fee,
    instructor_share_minor: amount - fee,
    provider: "manual",
    reference,
    status: "success",
    note: str(fd, "note") || null,
    paid_at: new Date().toISOString(),
  });
  if (error) return { error: error.code === "23505" ? "That reference is already used." : "Could not record the payment." };
  await db.from("enrollments").upsert({ user_id: buyer.id, course_id: course.id }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
  await audit(admin.id, "payment.manual", { type: "payment", id: reference }, { amount, course_id: course.id, user_id: buyer.id });
  refresh();
  return { ok: `Recorded ${reference} and enrolled ${buyer.full_name || email}.` };
}

export async function refundPayment(fd: FormData) {
  const { admin, db } = await requireSuperAdmin();
  const id = str(fd, "id");
  const { data: p } = await db.from("payments").select("user_id, course_id, status").eq("id", id).single();
  if (!p || p.status !== "success") return;
  await db.from("payments").update({ status: "refunded" }).eq("id", id);
  if (fd.get("revoke") === "on" && p.user_id && p.course_id) {
    await db.from("enrollments").delete().eq("user_id", p.user_id).eq("course_id", p.course_id);
  }
  await audit(admin.id, "payment.refund", { type: "payment", id });
  refresh();
}

export async function createPayout(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireSuperAdmin();
  const instructorId = str(fd, "instructor_id");
  const amount = nairaToMinor(str(fd, "amount"));
  if (!instructorId || amount <= 0) return { error: "Enter an amount above zero." };
  const markPaid = fd.get("paid") === "on";
  const { error } = await db.from("payouts").insert({
    instructor_id: instructorId,
    amount_minor: amount,
    reference: str(fd, "reference") || null,
    note: str(fd, "note") || null,
    status: markPaid ? "paid" : "pending",
    paid_at: markPaid ? new Date().toISOString() : null,
    created_by: admin.id,
  });
  if (error) return { error: "Could not record the payout." };
  await audit(admin.id, "payout.create", { type: "instructor", id: instructorId }, { amount, paid: markPaid });
  refresh();
  return { ok: markPaid ? "Payout recorded as paid." : "Payout scheduled." };
}

export async function setPayoutStatus(fd: FormData) {
  const { admin, db } = await requireSuperAdmin();
  const id = str(fd, "id");
  const status = str(fd, "status") === "paid" ? "paid" : "cancelled";
  await db.from("payouts").update({ status, paid_at: status === "paid" ? new Date().toISOString() : null }).eq("id", id).eq("status", "pending");
  await audit(admin.id, `payout.${status}`, { type: "payout", id });
  refresh();
}
