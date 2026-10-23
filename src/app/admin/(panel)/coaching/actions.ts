"use server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { audit, requireAdmin } from "@/lib/admin";
import { emailSessionCancelled } from "@/lib/email/coaching";
import type { FormState } from "@/app/(app)/teach/actions";

// Etivio's cut of each coaching session. Applies to new bookings only.
export async function setCoachCommission(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("coaching");
  const pct = Number(fd.get("percent"));
  if (!(pct >= 0 && pct <= 100)) return { error: "Enter a percentage from 0 to 100." };
  const { error } = await db.from("platform_settings").update({ coach_commission_percent: pct }).eq("id", true);
  if (error) return { error: "Could not save the commission." };
  await audit(admin.id, "coaching.commission", undefined, { percent: pct });
  refresh();
  return { ok: `Coach commission set to ${pct}%.` };
}

// Suspend takes a coach off Etivio (their page and booking close); restore puts them back as paused, for the coach
// to resume. Sessions already booked are left as they are.
export async function setCoachSuspended(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("coaching");
  const id = String(fd.get("id") ?? "");
  const suspend = fd.get("suspend") === "1";
  const { data } = await db
    .from("coach_profiles")
    .update({ status: suspend ? "suspended" : "paused", updated_at: new Date().toISOString() })
    .eq("user_id", id)
    .select("user_id")
    .maybeSingle();
  if (!data) return { error: "Coach not found." };
  await audit(admin.id, suspend ? "coaching.suspend" : "coaching.restore", { type: "user", id });
  refresh();
  return { ok: suspend ? "Coach suspended. Their page is hidden." : "Coach restored. They can resume bookings from Teach." };
}

export async function adminCancelSession(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("coaching");
  const id = String(fd.get("id") ?? "");
  const { data: ok } = await db.rpc("cancel_coach_booking", { p_booking: id, p_by: admin.id, p_reason: "Cancelled by Etivio" });
  if (!ok) return { error: "Only booked sessions can be cancelled." };
  await audit(admin.id, "coaching.cancel", { type: "coach_booking", id });
  after(() => emailSessionCancelled(id));
  refresh();
  return { ok: "Session cancelled. The learner was refunded to their wallet." };
}
