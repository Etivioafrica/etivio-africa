import Link from "next/link";
import { CheckCircle2, Search } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { SessionList } from "@/components/coaching/SessionList";
import { getCurrentUser } from "@/lib/auth";
import { LEARNER_CANCEL_HOURS, sessionsFor } from "@/lib/data/coaching";

export const metadata = { title: "Coaching sessions" };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ booked?: string }> }) {
  const [user, { booked }] = await Promise.all([getCurrentUser(), searchParams]);
  const sessions = await sessionsFor(user.id, "learner");
  return (
    <div className="et-page">
      <PageHead title="Coaching sessions" sub="Your 1-on-1 sessions with Etivio coaches.">
        <Link href="/coaches" className="et-btn et-btn-primary">
          <Search size={15} /> Find a coach
        </Link>
      </PageHead>
      {booked && (
        <p className="et-flash et-flash-ok" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <CheckCircle2 size={16} /> You&apos;re booked. We&apos;ve emailed you the details and will remind you an hour before.
        </p>
      )}
      <SessionList sessions={sessions} as="learner" cancelHours={LEARNER_CANCEL_HOURS} />
    </div>
  );
}
