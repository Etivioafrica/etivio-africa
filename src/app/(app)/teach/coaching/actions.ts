"use server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { featureOn } from "@/lib/data/features";
import { LEARNER_CANCEL_HOURS } from "@/lib/data/coaching";
import { emailSessionCancelled } from "@/lib/email/coaching";
import { isCoach, isStaff } from "@/lib/roles";
import { slugify } from "@/lib/format";
import { validTimezone } from "@/lib/coach-time";
import type { FormState } from "@/app/(app)/teach/actions";

// Coach tools (profile, hours, days off, their sessions) and cancelling a session, which learners use too.

async function coach() {
  const user = await getCurrentUser();
  if (!isCoach(user.roles)) return { user, error: "Only Etivio coaches can do this." };
  if (!(await featureOn("coaching"))) return { user, error: "Coaching isn't available right now." };
  return { user, error: null };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveCoachProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, error } = await coach();
  if (error) return { error };
  const headline = str(fd, "headline").slice(0, 120);
  const bio = str(fd, "bio").slice(0, 3000);
  const topics = [...new Set(str(fd, "topics").split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 8).map((t) => t.slice(0, 40));
  const minutes = Number(str(fd, "session_minutes"));
  const price = Number(str(fd, "price").replace(/[, ]/g, "") || "0");
  const timezone = str(fd, "timezone") || "Africa/Lagos";
  const notice = Number(str(fd, "notice_hours") || "12");
  const window = Number(str(fd, "window_days") || "30");
  const meeting = str(fd, "meeting_url");
  if (headline.length < 10) return { error: "Add a headline of at least 10 characters, like \"Product designer helping you land your first job\"." };
  if (![30, 45, 60, 90].includes(minutes)) return { error: "Pick a session length." };
  if (!Number.isFinite(price) || price < 0 || price > 5_000_000) return { error: "Enter a price between 0 and 5,000,000." };
  if (!validTimezone(timezone)) return { error: "Pick a valid time zone." };
  if (!Number.isInteger(notice) || notice < 0 || notice > 168) return { error: "Notice must be between 0 and 168 hours." };
  if (!Number.isInteger(window) || window < 7 || window > 90) return { error: "Booking window must be between 7 and 90 days." };
  if (meeting && !/^https:\/\/\S+$/.test(meeting)) return { error: "Your call link must start with https://" };

  const db = createAdminClient();
  const { data: existing } = await db.from("coach_profiles").select("slug").eq("user_id", user.id).maybeSingle();
  const row = {
    headline,
    bio: bio || null,
    topics,
    session_minutes: minutes,
    price_minor: Math.round(price * 100),
    timezone,
    notice_hours: notice,
    window_days: window,
    meeting_url: meeting || null,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const { error: e } = await db.from("coach_profiles").update(row).eq("user_id", user.id);
    if (e) return { error: "Could not save your profile." };
  } else {
    const base = (slugify(user.name || "coach").slice(0, 50) || "coach").replace(/^-+|-+$/g, "").padEnd(3, "x");
    let saved = false;
    for (let i = 0; i < 4 && !saved; i++) {
      const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { error: e } = await db.from("coach_profiles").insert({ ...row, user_id: user.id, slug });
      if (!e) saved = true;
      else if (e.code !== "23505") return { error: "Could not save your profile." };
    }
    if (!saved) return { error: "Could not save your profile." };
  }
  refresh();
  return { ok: existing ? "Profile saved." : "Profile created. Add your hours next, then publish." };
}

// Publish, pause or unpublish. Suspended profiles stay as they are until Etivio lifts it.
export async function setCoachStatus(status: "live" | "paused" | "draft"): Promise<FormState> {
  const { user, error } = await coach();
  if (error) return { error };
  const db = createAdminClient();
  const [{ data: p }, { count }] = await Promise.all([
    db.from("coach_profiles").select("status, headline").eq("user_id", user.id).maybeSingle(),
    db.from("coach_hours").select("id", { count: "exact", head: true }).eq("coach_id", user.id),
  ]);
  if (!p) return { error: "Set up your profile first." };
  if (p.status === "suspended") return { error: "Your coach page is paused by Etivio. Contact support to talk about it." };
  if (status === "live" && !count) return { error: "Add your weekly hours before you publish." };
  await db.from("coach_profiles").update({ status, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  refresh();
  return { ok: status === "live" ? "Your page is live. Learners can book you now." : status === "paused" ? "Paused. Learners can't book you until you resume." : "Unpublished." };
}

type Range = { weekday: number; start_min: number; end_min: number };

// Replaces the weekly hours. `hours` is JSON from the hours editor.
export async function saveHours(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, error } = await coach();
  if (error) return { error };
  let ranges: Range[];
  try {
    ranges = (JSON.parse(str(fd, "hours") || "[]") as Range[]).map((r) => ({ weekday: Math.trunc(r.weekday), start_min: Math.trunc(r.start_min), end_min: Math.trunc(r.end_min) }));
  } catch {
    return { error: "Could not read your hours." };
  }
  if (ranges.length > 50) return { error: "That's too many time ranges." };
  for (const r of ranges) {
    if (!(r.weekday >= 0 && r.weekday <= 6 && r.start_min >= 0 && r.end_min <= 1440 && r.start_min < r.end_min)) return { error: "Each range needs a start time before its end time." };
  }
  for (let d = 0; d <= 6; d++) {
    const day = ranges.filter((r) => r.weekday === d).sort((a, b) => a.start_min - b.start_min);
    for (let i = 1; i < day.length; i++) if (day[i].start_min < day[i - 1].end_min) return { error: "Two of your ranges on the same day overlap." };
  }
  const db = createAdminClient();
  const { data: p } = await db.from("coach_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!p) return { error: "Set up your profile first." };
  await db.from("coach_hours").delete().eq("coach_id", user.id);
  if (ranges.length) {
    const { error: e } = await db.from("coach_hours").insert(ranges.map((r) => ({ ...r, coach_id: user.id })));
    if (e) return { error: "Could not save your hours." };
  }
  refresh();
  return { ok: "Hours saved." };
}

export async function toggleDayOff(day: string, off: boolean): Promise<FormState> {
  const { user, error } = await coach();
  if (error) return { error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Pick a date." };
  const db = createAdminClient();
  const { data: p } = await db.from("coach_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!p) return { error: "Set up your profile first." };
  if (off) await db.from("coach_days_off").upsert({ coach_id: user.id, day }, { onConflict: "coach_id,day", ignoreDuplicates: true });
  else await db.from("coach_days_off").delete().eq("coach_id", user.id).eq("day", day);
  refresh();
  return { ok: off ? "Day off added." : "Day off removed." };
}

export async function setSessionLink(bookingId: string, url: string): Promise<FormState> {
  const { user, error } = await coach();
  if (error) return { error };
  const link = url.trim();
  if (link && !/^https:\/\/\S+$/.test(link)) return { error: "The call link must start with https://" };
  const { data } = await createAdminClient().from("coach_bookings").update({ meeting_url: link || null }).eq("id", bookingId).eq("coach_id", user.id).eq("status", "confirmed").select("id").maybeSingle();
  if (!data) return { error: "Could not update this session." };
  refresh();
  return { ok: "Call link saved." };
}

// The learner didn't turn up. The coach is still paid.
export async function markNoShow(bookingId: string): Promise<FormState> {
  const { user, error } = await coach();
  if (error) return { error };
  const { data } = await createAdminClient()
    .from("coach_bookings")
    .update({ status: "no_show" })
    .eq("id", bookingId)
    .eq("coach_id", user.id)
    .eq("status", "confirmed")
    .lt("starts_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (!data) return { error: "You can mark a no-show once the session has started." };
  refresh();
  return { ok: "Marked as a no-show." };
}

// Learners cancel up to 24 hours before; coaches and Etivio staff any time before it starts. The learner's money
// goes back to their wallet.
export async function cancelSession(bookingId: string, reason: string): Promise<FormState> {
  const user = await getCurrentUser();
  const db = createAdminClient();
  const { data: b } = await db.from("coach_bookings").select("id, coach_id, learner_id, starts_at, status").eq("id", bookingId).maybeSingle();
  if (!b || b.status !== "confirmed") return { error: "This session can't be cancelled." };
  const asCoach = b.coach_id === user.id;
  const asLearner = b.learner_id === user.id;
  if (!asCoach && !asLearner && !isStaff(user.roles)) return { error: "This session can't be cancelled." };
  const left = Date.parse(b.starts_at) - Date.now();
  if (left <= 0) return { error: "This session has already started." };
  if (asLearner && !asCoach && left < LEARNER_CANCEL_HOURS * 3_600_000) return { error: `Sessions can be cancelled up to ${LEARNER_CANCEL_HOURS} hours before. Message your coach if something came up.` };
  const { data: ok } = await db.rpc("cancel_coach_booking", { p_booking: b.id, p_by: user.id, p_reason: reason.trim().slice(0, 500) || "" });
  if (!ok) return { error: "This session can't be cancelled." };
  after(() => emailSessionCancelled(b.id));
  refresh();
  return { ok: asLearner ? "Cancelled. The full amount is back in your wallet." : "Cancelled. The learner's money is back in their wallet." };
}
