import Link from "next/link";
import { CalendarCheck, CalendarClock, ExternalLink, Video, Wallet } from "lucide-react";
import { PageHead, Stat } from "@/components/dash/ui";
import { SessionList } from "@/components/coaching/SessionList";
import { getCurrentUser } from "@/lib/auth";
import { LEARNER_CANCEL_HOURS, myCoachProfile, sessionsFor } from "@/lib/data/coaching";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Coaching" };

const clock = () => Date.now();

export default async function CoachingPage() {
  const user = await getCurrentUser();
  const [{ profile, hours }, sessions, { data: available }] = await Promise.all([myCoachProfile(user.id), sessionsFor(user.id, "coach"), createAdminClient().rpc("payout_available", { p_user: user.id })]);
  const now = clock();
  const upcoming = sessions.filter((s) => s.status === "confirmed" && Date.parse(s.endsAt) > now).length;
  const done = sessions.filter((s) => ["confirmed", "completed", "no_show"].includes(s.status) && Date.parse(s.endsAt) <= now);
  const earned = done.reduce((n, s) => n + s.priceMinor, 0);

  return (
    <div className="et-page">
      <PageHead title="Coaching" sub="Your sessions with learners.">
        {profile && (
          <Link href={`/coaches/${profile.slug}`} className="et-btn et-btn-ghost" target="_blank">
            <ExternalLink size={15} /> View my page
          </Link>
        )}
      </PageHead>

      {!profile ? (
        <section className="et-card et-card-pad et-cb-setup">
          <h2>Set up your coach page</h2>
          <p className="et-muted">Add a headline, your price and the hours you&apos;re free. Then publish and learners can book you.</p>
          <Link href="/teach/coaching/profile" className="et-btn et-btn-primary">
            Set up profile
          </Link>
        </section>
      ) : profile.status !== "live" ? (
        <p className="et-flash et-flash-err">
          {profile.status === "suspended"
            ? "Etivio has paused your coach page. Contact support to talk about it."
            : !hours.length
              ? "Your page isn't live. Add your hours, then publish it from your profile."
              : "Your page isn't live, so learners can't book you."}{" "}
          {profile.status !== "suspended" && <Link href={hours.length ? "/teach/coaching/profile" : "/teach/coaching/hours"}>{hours.length ? "Publish it" : "Add hours"}</Link>}
        </p>
      ) : null}

      <div className="et-stats">
        <Stat label="Upcoming" value={upcoming} icon={CalendarClock} />
        <Stat label="Sessions done" value={done.length} icon={CalendarCheck} />
        <Stat label="Sessions value" value={formatMoney(earned)} icon={Video} hint="Before Etivio's commission" />
        <Stat label="Available to withdraw" value={formatMoney(Math.max(0, Number(available ?? 0)))} icon={Wallet} href="/teach/earnings" />
      </div>

      <SessionList sessions={sessions} as="coach" cancelHours={LEARNER_CANCEL_HOURS} />
    </div>
  );
}
