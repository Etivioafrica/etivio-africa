import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { Progress } from "@/components/dash/ui";
import { BadgeSeal } from "@/components/dash/Badges";
import { getCurrentUser } from "@/lib/auth";
import { getLearnerProfile } from "@/lib/data/profile";
import { allBadges, nextBadge } from "@/lib/badges";
import { percent } from "@/lib/format";

export const metadata = { title: "Badges" };

export default function BadgesPage() {
  return (
    <Suspense
      fallback={
  <div className="et-skel" style={{ height: 200 }} />
      }
    >
      <BadgesContent />
    </Suspense>
  );
}

async function BadgesContent() {
  const user = await getCurrentUser();
  const data = await getLearnerProfile(user.id);
  if (!data) notFound();

  const input = {
    joinedAt: data.profile.joinedAt,
    lessonsDone: data.stats.lessonsDone,
    coursesCompleted: data.stats.completed,
    longestStreak: data.heatmap.longestStreak,
  };
  const badges = allBadges(input);
  const next = nextBadge(input);
  const earned = badges.filter((b) => b.earned).length;

  return (
    <>
      <p className="et-muted" style={{ fontSize: 13.5, marginTop: -4 }}>
        {earned} of {badges.length} earned. Keep learning to unlock the rest.
      </p>

      {next && (
        <section className="et-card et-next-badge">
          <BadgeSeal id={next.badge.id} size={128} locked />
          <div className="et-next-badge-body">
            <span className="et-tag">Up next</span>
            <h2>{next.badge.label}</h2>
            <p>{next.badge.how}</p>
            <Progress value={percent(next.current, next.target)} label={`${next.current} / ${next.target} ${next.unit}`} />
            <div>
              <Link href={data.courses.length ? "/learn/courses" : "/learn/browse"} className="et-btn et-btn-primary">
                {data.courses.length ? "Continue learning" : "Find a course"} <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="et-badge-grid">
        {badges.map((b) => (
          <div key={b.badge.id} className={`et-card et-badge-card${b.earned ? "" : " is-locked"}`}>
            <BadgeSeal id={b.badge.id} size={112} locked={!b.earned} />
            <h3>{b.badge.label}</h3>
            <p>{b.earned ? b.badge.hint : b.badge.how}</p>
            {b.earned ? (
              <span className="et-badge-state is-earned">
                <CheckCircle2 size={14} /> Earned
              </span>
            ) : (
              <>
                <Progress value={percent(b.current, b.target)} label={`${b.current}/${b.target}`} />
                <span className="et-badge-state">
                  <Lock size={13} /> Locked
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
