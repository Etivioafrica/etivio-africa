import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/format";
import { render } from "./layout";
import { recipient } from "./recipients";
import { sendEmail, siteUrl } from "./send";

// Coaching session emails: booked, cancelled and the reminder an hour before. Each goes to both the learner and the
// coach, with times shown in that person's coach timezone (learners see the coach's timezone named).

async function booking(id: string) {
  const { data } = await createAdminClient()
    .from("coach_bookings")
    .select("id, coach_id, learner_id, starts_at, ends_at, status, price_minor, currency, note, cancel_reason, cancelled_by, coach:coach_profiles!coach_bookings_coach_id_fkey(slug, timezone, profile:profiles!coach_profiles_user_id_fkey(full_name)), learner:profiles!coach_bookings_learner_id_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

const when = (iso: string, tz: string) =>
  `${new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))} (${tz.replace("_", " ")})`;

type Who = "learner" | "coach";

function content(kind: "booked" | "cancelled" | "reminder", who: Who, b: NonNullable<Awaited<ReturnType<typeof booking>>>, name: string) {
  const coach = b.coach?.profile?.full_name || "your coach";
  const learner = b.learner?.full_name || "a learner";
  const other = who === "learner" ? coach : learner;
  const tz = b.coach?.timezone ?? "Africa/Lagos";
  const page = `${siteUrl()}${who === "learner" ? "/learn/sessions" : "/teach/coaching"}`;
  const rows: [string, string][] = [
    ["When", when(b.starts_at, tz)],
    ["Length", `${Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60_000)} minutes`],
    [who === "learner" ? "Coach" : "Learner", other],
  ];
  if (kind === "booked" && b.price_minor > 0) rows.push(["Paid", formatPrice(b.price_minor, b.currency)]);
  const subject =
    kind === "booked" ? `Session booked with ${other}` : kind === "cancelled" ? `Session with ${other} cancelled` : `Your session with ${other} starts in an hour`;
  const blocks =
    kind === "booked"
      ? [
          { p: who === "learner" ? `You're booked with ${coach}. The video call happens right on Etivio: open your Sessions page and press Join when it's time. We'll remind you an hour before.` : `${learner} booked a session with you.` },
          ...(b.note ? [{ p: who === "learner" ? "What you told your coach:" : "What they'd like to cover:" }, { quote: b.note }] : []),
        ]
      : kind === "cancelled"
        ? [
            { p: `The session with ${other} was cancelled${b.cancelled_by === b.learner_id ? (who === "learner" ? " by you" : " by the learner") : b.cancelled_by === b.coach_id ? (who === "coach" ? " by you" : " by the coach") : " by Etivio"}.` },
            ...(b.cancel_reason ? [{ quote: b.cancel_reason }] : []),
            ...(who === "learner" && b.price_minor > 0 ? [{ p: `${formatPrice(b.price_minor, b.currency)} is back in your Etivio wallet. Use it to book again or on any course.` }] : []),
          ]
        : [{ p: "The call happens on Etivio. The room opens 15 minutes before; join from a laptop or phone, and headphones help." }];
  return {
    subject,
    ...render({
      preheader: rows[0][1],
      banner: kind === "cancelled" ? "support_reply" : "confirmation",
      heading: kind === "booked" ? "Session booked" : kind === "cancelled" ? "Session cancelled" : "Starting soon",
      greeting: name,
      blocks,
      info: { title: "Coaching session", rows },
      cta: kind === "cancelled" ? { label: "Open sessions", url: page } : { label: kind === "reminder" ? "Join the call" : "Open sessions", url: kind === "reminder" ? `${siteUrl()}/sessions/${b.id}` : page },
      reason: "You're getting this because of a coaching session on Etivio.",
    }),
  };
}

async function toBoth(kind: "booked" | "cancelled" | "reminder", id: string) {
  const b = await booking(id);
  if (!b) return;
  for (const who of ["learner", "coach"] as Who[]) {
    const r = await recipient(who === "learner" ? b.learner_id : b.coach_id);
    if (!r) continue;
    await sendEmail({ to: r.email, userId: r.userId, kind: `session_${kind}`, ref: `${b.id}#${who}`, ...content(kind, who, b, r.name) });
  }
}

export const emailSessionBooked = (id: string) => toBoth("booked", id);
export const emailSessionCancelled = (id: string) => toBoth("cancelled", id);

// Called by the coach-reminders cron: sessions starting in the next 70 minutes that haven't been reminded.
export async function sendSessionReminders() {
  const db = createAdminClient();
  const now = Date.now();
  const { data } = await db
    .from("coach_bookings")
    .select("id")
    .eq("status", "confirmed")
    .is("reminded_at", null)
    .gt("starts_at", new Date(now).toISOString())
    .lt("starts_at", new Date(now + 70 * 60_000).toISOString());
  let sent = 0;
  for (const b of data ?? []) {
    const { data: claimed } = await db.from("coach_bookings").update({ reminded_at: new Date().toISOString() }).eq("id", b.id).is("reminded_at", null).select("id").maybeSingle();
    if (!claimed) continue;
    await toBoth("reminder", b.id);
    sent++;
  }
  return sent;
}
