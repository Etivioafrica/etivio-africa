import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, BookCheck, CheckCircle2, Clock, Flame, Presentation } from "lucide-react";
import { Cover, Progress, StatStrip } from "@/components/dash/ui";
import { ProfileHero } from "@/components/dash/ProfileView";
import { ActivityHeatmap } from "@/components/dash/ActivityHeatmap";
import { Badges } from "@/components/dash/Badges";
import { allBadges } from "@/lib/badges";
import { getPublicProfile, type PublicCourse, type PublicProfile } from "@/lib/data/public-profile";
import Link from "next/link";
import { formatDate, formatDuration } from "@/lib/format";
import { normalizeUsername } from "@/lib/username";
import { ReportButton } from "@/components/moderation/ReportButton";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicProfile(normalizeUsername(decodeURIComponent((await params).username)));
  if (!data) return { title: "Profile not found | Etivio", robots: { index: false } };
  const { profile: p } = data;
  const title = `${p.name} (@${p.username}) | Etivio`;
  const description = p.headline || p.bio?.slice(0, 160) || `${p.name} learns on Etivio.`;
  // The preview image comes from ./opengraph-image.tsx.
  return { title, description, openGraph: { title, description } };
}

export default function PublicProfilePage({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
      <PublicProfileContent params={params} />
    </Suspense>
  );
}

async function PublicProfileContent({ params }: Props) {
  const username = normalizeUsername(decodeURIComponent((await params).username));
  const data = await getPublicProfile(username);
  if (!data) notFound();
  const { profile, completed, teaching, stats, heatmap } = data;

  return (
    <>
      <ProfileHero profile={profile} badges={publicBadge(data)} skills={data.skills} />

      <StatStrip
        items={[
          { label: "Courses completed", value: stats.completed, icon: CheckCircle2 },
          { label: "Lessons done", value: stats.lessonsDone, icon: BookCheck },
          { label: "Learning time", value: formatDuration(stats.secondsLearned) || "0 min", icon: Clock },
          stats.teaching > 0
            ? { label: "Courses taught", value: stats.teaching, icon: Presentation }
            : { label: "Active days", value: heatmap.activeDays, icon: Flame },
        ]}
      />

      <ActivityHeatmap data={heatmap} />

      {data.learning.length > 0 && <CourseSection title="Currently learning" courses={data.learning} />}

      {data.certificates.length > 0 && (
        <section className="et-card">
          <div className="et-card-head">
            <h2>Certificates</h2>
            <span className="et-muted" style={{ fontSize: 12.5 }}>
              Verified by Etivio
            </span>
          </div>
          <ul className="et-feed">
            {data.certificates.map((c) => (
              <li key={c.code}>
                <BadgeCheck size={16} style={{ color: "#16a34a", flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ color: "var(--a-fg)" }}>{c.courseTitle}</b>
                  <br />
                  <small className="et-muted">
                    Issued {formatDate(c.issuedAt)} · ID {c.code}
                  </small>
                </span>
                <Link href={`/certificate/${c.code}`} className="et-btn et-btn-ghost et-btn-sm">
                  View
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {teaching.length > 0 && <CourseSection title={`Courses by ${profile.name}`} courses={teaching} />}
      <CourseSection
        title="Completed courses"
        courses={completed}
        empty={`${profile.name.split(" ")[0]} hasn't completed a course yet.`}
      />
      <p className="et-report-foot">
        <ReportButton type="profile" id={profile.id} label="Report this profile" />
      </p>
    </>
  );
}

function CourseSection({ title, courses, empty }: { title: string; courses: PublicCourse[]; empty?: string }) {
  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>{title}</h2>
      </div>
      {courses.length ? (
        <div className="et-pf-courses">
          {courses.map((c) => (
            <div key={c.id} className="et-pf-course">
              <Cover url={c.coverUrl} level={c.level} />
              {c.title}
              {c.progress !== undefined && <Progress value={c.progress} />}
            </div>
          ))}
        </div>
      ) : (
        <p className="et-empty">{empty}</p>
      )}
    </section>
  );
}

// Latest badge for visitors; hidden until the learner has earned one.
function publicBadge({ profile, stats, heatmap, latestBadge }: PublicProfile) {
  const earned = allBadges({
    joinedAt: profile.joinedAt,
    lessonsDone: stats.lessonsDone,
    coursesCompleted: stats.completed,
    longestStreak: heatmap.longestStreak,
    teaches: stats.teaching > 0,
  }).filter((b) => b.earned);
  const featured = (latestBadge && earned.find((b) => b.badge.id === latestBadge.id)) || earned[0];
  if (!featured) return undefined;
  return <Badges featured={featured} earnedAt={latestBadge?.id === featured.badge.id ? latestBadge.earnedAt : undefined} earned={earned.length} />;
}
