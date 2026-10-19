import Link from "next/link";
import { BookOpen, CheckCircle2, Flame, ListChecks } from "lucide-react";
import { Cover, Empty, Progress, Stat } from "@/components/dash/ui";
import { CourseGrid } from "@/components/dash/CourseGrid";
import { getMyCourses, getSavedIds } from "@/lib/data/learn";
import { getLearnerPrefs, getRecommendations } from "@/lib/data/recommend";
import { getLearnerProfile } from "@/lib/data/profile";
import { LearnerGuidance } from "@/components/dash/LearnerGuidance";
import { WelcomeHero } from "@/components/dash/WelcomeHero";
import { getPlatformSettings } from "@/lib/platform";
import { AnnouncementBar } from "@/components/dash/AnnouncementBar";
import { getCurrentUser } from "@/lib/auth";
import { syncBadges } from "@/lib/data/badges";
import { syncCertificates } from "@/lib/data/certificates";
import { after } from "next/server";
import { sendDueAnnouncements } from "@/lib/email/notify";

export const metadata = { title: "Learn" };

export default async function LearnDashboard() {
  const user = await getCurrentUser();
  // Sends any scheduled announcement whose time has passed (claimed once, so this is cheap when there's nothing due).
  after(sendDueAnnouncements);
  // Landing page after sign-in, so it also catches badges earned outside a lesson (e.g. Early learner).
  const [mine, recommended, prefs, profile, savedIds] = await Promise.all([
    getMyCourses(),
    getRecommendations(3),
    getLearnerPrefs(),
    getLearnerProfile(user.id),
    getSavedIds(),
    syncBadges(user.id),
    syncCertificates(user.id),
  ]);
  const platform = await getPlatformSettings();
  // Lessons this week (Sunday to Saturday), from the activity heatmap's current column.
  const thisWeek = profile?.heatmap.weeks.at(-1)?.reduce((n, d) => n + d.count, 0) ?? 0;
  const active = mine.filter((c) => !c.completed);
  const completed = mine.filter((c) => c.completed);
  const lessonsDone = mine.reduce((n, c) => n + c.done, 0);
  const enrolledIds = new Set(mine.map((c) => c.id));
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // The banner's one next step: the course they touched most recently, else something new to start.
  const current = active[0];
  const hero = current
    ? {
        message: current.done
          ? `You're ${current.progress}% through ${current.title}. Keep going to reach your goal.`
          : `You're enrolled in ${current.title}. Start your first lesson today.`,
        cta: { label: current.done ? "Continue learning" : "Start learning", href: `/learn/course/${current.id}` },
      }
    : mine.length
      ? { message: "You've finished every course you started. Ready for the next one?", cta: { label: "Find a new course", href: "/learn/browse" } }
      : { message: "Find your first course and start learning today. Your progress, badges, and certificates start here.", cta: { label: "Browse courses", href: "/learn/browse" } };

  return (
    <div className="et-page">
      {platform.announcement && <AnnouncementBar text={platform.announcement.text} link={platform.announcement.link} />}
      <WelcomeHero name={(user.name || "there").split(" ")[0]} date={today} message={hero.message} cta={hero.cta} background={platform.heroBgUrl} />

      <LearnerGuidance goal={prefs.goal} weeklyGoal={prefs.weeklyGoal} thisWeek={thisWeek} />

      <div className="et-stats">
        <Stat label="Enrolled" value={mine.length} icon={BookOpen} href="/learn/courses" />
        <Stat label="In progress" value={active.length} icon={Flame} href="/learn/courses" />
        <Stat label="Completed" value={completed.length} icon={CheckCircle2} href="/learn/courses" />
        <Stat label="Lessons done" value={lessonsDone} icon={ListChecks} />
      </div>

      <div className="et-grid-main">
        <section className="et-card">
          <div className="et-card-head">
            <h2>Continue learning</h2>
            <Link href="/learn/courses">View all</Link>
          </div>
          {active.length ? (
            <div className="et-list">
              {active.slice(0, 5).map((c) => (
                <Link key={c.id} href={`/learn/course/${c.id}`} className="et-list-item">
                  <Cover url={c.coverUrl} small />
                  <div className="et-list-main">
                    <b>{c.title}</b>
                    <Progress value={c.progress} label={`${c.done}/${c.lessonCount} lessons`} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="Nothing in progress" action={{ href: "/learn/browse", label: "Browse courses" }}>
              Enroll in a course and it will show up here.
            </Empty>
          )}
        </section>

        <section className="et-card">
          <div className="et-card-head">
            <h2>Completed</h2>
          </div>
          {completed.length ? (
            <div className="et-list">
              {completed.slice(0, 5).map((c) => (
                <Link key={c.id} href={`/learn/course/${c.id}`} className="et-list-item">
                  <Cover url={c.coverUrl} small />
                  <div className="et-list-main">
                    <b>{c.title}</b>
                    <small style={{ color: "var(--a-faint)", fontSize: 12 }}>{c.lessonCount} lessons</small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="et-empty">Finished courses land here.</p>
          )}
        </section>
      </div>

      {recommended.length > 0 && (
        <section className="et-page" style={{ gap: 14 }}>
          <div className="et-toolbar">
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{prefs.interests.length || prefs.level ? "Recommended for you" : "Explore courses"}</h2>
              {(prefs.interests.length > 0 || prefs.level) && (
                <p className="et-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                  Based on your interests{prefs.level ? " and level" : ""}. <Link href="/settings" style={{ color: "var(--accent)" }}>Update interests</Link>
                </p>
              )}
            </div>
            <Link href="/learn/browse" className="et-btn et-btn-ghost et-btn-sm">
              Browse all
            </Link>
          </div>
          <CourseGrid courses={recommended} enrolledIds={enrolledIds} savedIds={savedIds} />
        </section>
      )}
    </div>
  );
}
