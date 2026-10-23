import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { freeSlots, type Hours } from "@/lib/coach-time";
import { emailSessionBooked } from "@/lib/email/coaching";

// Coaches and booking (migration 0049). Reads go through the service role after the caller has checked who's asking.

export type CoachStatus = "draft" | "live" | "paused" | "suspended";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export const HOLD_MINUTES = 30;
// Learners can cancel (and get their money back in their wallet) up to this long before a session.
export const LEARNER_CANCEL_HOURS = 24;

export type CoachCard = {
  userId: string;
  slug: string;
  name: string;
  avatar: string | null;
  headline: string | null;
  topics: string[];
  minutes: number;
  priceMinor: number;
  currency: string;
  sessions: number;
};

const clock = () => Date.now();

export async function listCoaches(topic?: string): Promise<CoachCard[]> {
  const db = createAdminClient();
  let q = db
    .from("coach_profiles")
    .select("user_id, slug, headline, topics, session_minutes, price_minor, currency, profile:profiles!coach_profiles_user_id_fkey(full_name, avatar_url, status)")
    .eq("status", "live")
    .order("created_at");
  if (topic) q = q.contains("topics", [topic]);
  const [{ data }, { data: done }] = await Promise.all([q, db.from("coach_bookings").select("coach_id").in("status", ["confirmed", "completed"]).lt("ends_at", new Date().toISOString())]);
  const count = new Map<string, number>();
  for (const b of done ?? []) count.set(b.coach_id, (count.get(b.coach_id) ?? 0) + 1);
  return (data ?? [])
    .filter((c) => c.profile?.status === "active")
    .map((c) => ({
      userId: c.user_id,
      slug: c.slug,
      name: c.profile?.full_name || "Coach",
      avatar: c.profile?.avatar_url ?? null,
      headline: c.headline,
      topics: c.topics,
      minutes: c.session_minutes,
      priceMinor: c.price_minor,
      currency: c.currency,
      sessions: count.get(c.user_id) ?? 0,
    }));
}

// Pending holds that haven't run out, and confirmed sessions, block their time.
async function busyTimes(coachId: string, from: string) {
  const { data } = await createAdminClient()
    .from("coach_bookings")
    .select("starts_at, ends_at, status, hold_expires_at")
    .eq("coach_id", coachId)
    .in("status", ["pending", "confirmed"])
    .gt("ends_at", from);
  const now = clock();
  return (data ?? []).filter((b) => b.status === "confirmed" || (b.hold_expires_at && Date.parse(b.hold_expires_at) > now));
}

// A live coach's page: profile and free times. Drafts and paused profiles show only to the coach (preview).
export async function getCoach(slug: string, viewerId: string | null) {
  const db = createAdminClient();
  const { data: c } = await db
    .from("coach_profiles")
    .select("*, profile:profiles!coach_profiles_user_id_fkey(full_name, avatar_url, username, location, status)")
    .eq("slug", slug)
    .maybeSingle();
  if (!c || c.profile?.status !== "active" || (c.status !== "live" && c.user_id !== viewerId)) return null;
  const now = clock();
  const [{ data: hours }, { data: off }, busy] = await Promise.all([
    db.from("coach_hours").select("weekday, start_min, end_min").eq("coach_id", c.user_id),
    db.from("coach_days_off").select("day").eq("coach_id", c.user_id).gte("day", new Date(now - 86_400_000).toISOString().slice(0, 10)),
    busyTimes(c.user_id, new Date(now).toISOString()),
  ]);
  const days = freeSlots({
    hours: (hours ?? []) as Hours[],
    daysOff: (off ?? []).map((d) => d.day),
    busy,
    minutes: c.session_minutes,
    tz: c.timezone,
    noticeHours: c.notice_hours,
    windowDays: c.window_days,
    now,
  });
  return { ...c, name: c.profile?.full_name || "Coach", avatar: c.profile?.avatar_url ?? null, days };
}

// Is this start time still free for the coach? Re-checked when booking, since the page may be old.
export async function slotIsFree(coach: NonNullable<Awaited<ReturnType<typeof getCoach>>>, startsAt: string) {
  return coach.days.some((d) => d.slots.includes(startsAt));
}

export async function myCoachProfile(userId: string) {
  const db = createAdminClient();
  const [{ data: profile }, { data: hours }, { data: off }] = await Promise.all([
    db.from("coach_profiles").select("*").eq("user_id", userId).maybeSingle(),
    db.from("coach_hours").select("weekday, start_min, end_min").eq("coach_id", userId).order("weekday").order("start_min"),
    db.from("coach_days_off").select("day").eq("coach_id", userId).gte("day", new Date().toISOString().slice(0, 10)).order("day"),
  ]);
  return { profile, hours: (hours ?? []) as Hours[], daysOff: (off ?? []).map((d) => d.day) };
}

export type SessionRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  priceMinor: number;
  currency: string;
  note: string | null;
  meetingUrl: string | null;
  cancelReason: string | null;
  other: { id: string; name: string; avatar: string | null; slug?: string | null };
};

// Sessions for a learner (with their coach) or for a coach (with the learner). Unpaid holds aren't shown.
export async function sessionsFor(userId: string, as: "learner" | "coach"): Promise<SessionRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("coach_bookings")
    .select(
      "id, starts_at, ends_at, status, price_minor, currency, note, meeting_url, cancel_reason, coach_id, learner_id, learner:profiles!coach_bookings_learner_id_fkey(full_name, avatar_url), coach:coach_profiles!coach_bookings_coach_id_fkey(slug, profile:profiles!coach_profiles_user_id_fkey(full_name, avatar_url))",
    )
    .eq(as === "learner" ? "learner_id" : "coach_id", userId)
    .neq("status", "pending")
    .order("starts_at", { ascending: false })
    .limit(200);
  return (data ?? [])
    .filter((b) => !(b.status === "cancelled" && b.cancel_reason === "Not paid in time"))
    .map((b) => ({
      id: b.id,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      status: b.status as BookingStatus,
      priceMinor: b.price_minor,
      currency: b.currency,
      note: b.note,
      meetingUrl: b.meeting_url,
      cancelReason: b.cancel_reason,
      other:
        as === "learner"
          ? { id: b.coach_id, name: b.coach?.profile?.full_name || "Coach", avatar: b.coach?.profile?.avatar_url ?? null, slug: b.coach?.slug ?? null }
          : { id: b.learner_id, name: b.learner?.full_name || "Learner", avatar: b.learner?.avatar_url ?? null },
    }));
}

// A pending booking that holds the time while the learner pays. Returns null if the time was just taken.
export async function holdSession(coach: { user_id: string; session_minutes: number; price_minor: number; currency: string }, learnerId: string, startsAt: string, note: string | null) {
  const db = createAdminClient();
  await db.rpc("release_coach_holds");
  const ends = new Date(Date.parse(startsAt) + coach.session_minutes * 60_000).toISOString();
  const { data, error } = await db
    .from("coach_bookings")
    .insert({
      coach_id: coach.user_id,
      learner_id: learnerId,
      starts_at: startsAt,
      ends_at: ends,
      status: "pending",
      price_minor: coach.price_minor,
      currency: coach.currency,
      note,
      hold_expires_at: new Date(clock() + HOLD_MINUTES * 60_000).toISOString(),
    })
    .select("id, starts_at, ends_at")
    .single();
  if (error || !data) return null;
  return data;
}

// The order and payments row for a held session. The coach's share uses Etivio's coach commission.
export async function sessionOrder(booking: { id: string }, coach: { user_id: string; price_minor: number; currency: string }, buyer: { id: string; email: string; firstName: string; lastName: string }, walletMinor: number) {
  const db = createAdminClient();
  const reference = `ET${randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase()}`;
  const { data: settings } = await db.from("platform_settings").select("coach_commission_percent").maybeSingle();
  const commission = Number(settings?.coach_commission_percent ?? 20);
  const { data: order } = await db
    .from("orders")
    .insert({
      reference,
      user_id: buyer.id,
      email: buyer.email,
      first_name: buyer.firstName,
      last_name: buyer.lastName,
      total_minor: coach.price_minor - walletMinor,
      wallet_minor: walletMinor,
      currency: coach.currency,
      purpose: "coach_booking",
    })
    .select("id, reference, total_minor, currency")
    .single();
  if (!order) return null;
  const share = Math.floor((coach.price_minor * (100 - commission)) / 100);
  const { error } = await db.from("payments").insert({
    order_id: order.id,
    user_id: buyer.id,
    coach_booking_id: booking.id,
    amount_minor: coach.price_minor,
    currency: coach.currency,
    instructor_id: coach.user_id,
    instructor_share_minor: share,
    platform_fee_minor: coach.price_minor - share,
    provider: walletMinor >= coach.price_minor ? "wallet" : "paystack",
    reference: `${reference}-1`,
    status: "pending",
  });
  if (error) {
    await db.from("orders").delete().eq("id", order.id);
    return null;
  }
  await db.from("coach_bookings").update({ order_id: order.id }).eq("id", booking.id);
  return order;
}

// The session's payment cleared (Paystack, or the wallet). Confirms it, or, if the hold ran out and someone else
// took the time meanwhile, puts the money in the learner's wallet. Safe to call more than once.
export async function sessionPaid(orderId: string, paidAt: string) {
  const db = createAdminClient();
  const { data: b } = await db.from("coach_bookings").select("id, coach_id, learner_id, status, cancel_reason, price_minor, currency").eq("order_id", orderId).maybeSingle();
  if (!b) return;
  await db.from("payments").update({ status: "success", paid_at: paidAt }).eq("order_id", orderId).eq("status", "pending");
  const { data: coach } = await db.from("coach_profiles").select("meeting_url").eq("user_id", b.coach_id).maybeSingle();
  const confirm = () =>
    db
      .from("coach_bookings")
      .update({ status: "confirmed", hold_expires_at: null, meeting_url: coach?.meeting_url ?? null, cancel_reason: null, cancelled_at: null })
      .eq("id", b.id);
  if (b.status === "pending") {
    const { error } = await confirm().eq("status", "pending");
    if (!error) after(() => emailSessionBooked(b.id));
    return;
  }
  if (b.status === "cancelled" && b.cancel_reason === "Not paid in time") {
    const { error } = await confirm().eq("status", "cancelled");
    if (!error) {
      after(() => emailSessionBooked(b.id));
      return;
    }
    // The time went to someone else: their money goes to their wallet.
    await db.from("payments").update({ status: "refunded", note: "Paid after the time was taken, refunded to wallet" }).eq("order_id", orderId);
    if (b.price_minor > 0)
      await db
        .from("wallet_transactions")
        .insert({ user_id: b.learner_id, amount_minor: b.price_minor, currency: b.currency, kind: "session_refund", order_id: orderId, coach_booking_id: b.id, note: "Coaching time was taken before your payment arrived" });
  }
}

// Admin: every coach (any status) with session counts and earnings so far.
export async function adminCoaches() {
  const db = createAdminClient();
  const [{ data: coaches }, { data: bookings }, { data: roleRows }] = await Promise.all([
    db.from("coach_profiles").select("user_id, slug, headline, status, price_minor, currency, session_minutes, created_at, profile:profiles!coach_profiles_user_id_fkey(full_name, avatar_url)").order("created_at", { ascending: false }),
    db.from("coach_bookings").select("coach_id, status, price_minor, ends_at").in("status", ["confirmed", "completed", "no_show"]),
    db.from("user_roles").select("user_id, profile:profiles!user_roles_user_id_fkey(full_name, avatar_url)").eq("role", "coach"),
  ]);
  const now = clock();
  const stats = new Map<string, { upcoming: number; done: number; revenue: number }>();
  for (const b of bookings ?? []) {
    const s = stats.get(b.coach_id) ?? { upcoming: 0, done: 0, revenue: 0 };
    if (Date.parse(b.ends_at) > now) s.upcoming++;
    else s.done++;
    s.revenue += b.price_minor;
    stats.set(b.coach_id, s);
  }
  const withProfile = new Set((coaches ?? []).map((c) => c.user_id));
  return {
    coaches: (coaches ?? []).map((c) => ({ ...c, name: c.profile?.full_name || "Coach", avatar: c.profile?.avatar_url ?? null, ...(stats.get(c.user_id) ?? { upcoming: 0, done: 0, revenue: 0 }) })),
    // Have the coach role but haven't set up a profile yet.
    notStarted: (roleRows ?? []).filter((r) => !withProfile.has(r.user_id)).map((r) => ({ userId: r.user_id, name: r.profile?.full_name || "Coach", avatar: r.profile?.avatar_url ?? null })),
  };
}

export async function adminSessions(limit = 100) {
  const { data } = await createAdminClient()
    .from("coach_bookings")
    .select("id, starts_at, ends_at, status, price_minor, currency, cancel_reason, learner:profiles!coach_bookings_learner_id_fkey(full_name), coach:coach_profiles!coach_bookings_coach_id_fkey(slug, profile:profiles!coach_profiles_user_id_fkey(full_name))")
    .neq("status", "pending")
    .order("starts_at", { ascending: false })
    .limit(limit);
  return (data ?? []).filter((b) => !(b.status === "cancelled" && b.cancel_reason === "Not paid in time"));
}
