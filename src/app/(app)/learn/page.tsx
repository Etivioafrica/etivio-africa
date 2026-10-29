import { after } from "next/server";
import { getCatalog, getMyCourses, quizProgress } from "@/lib/data/learn";
import { getLearnerProfile } from "@/lib/data/profile";
import { sessionsFor } from "@/lib/data/coaching";
import { getChecklist, getGuideState } from "@/lib/data/guide";
import { featuresFor } from "@/lib/data/features";
import { getCampusPulse, getQuizStats, getQuizzesToDo } from "@/lib/data/dashboard";
import { LearnBoard } from "@/components/dash/LearnBoard";
import { BADGE_INFO, nextBadge } from "@/lib/badges";
import type { Task } from "@/components/dash/LearnBoardClient";
import { WelcomeHero } from "@/components/dash/WelcomeHero";
import { MobileHome } from "@/components/dash/MobileHome";
import { getPlatformSettings } from "@/lib/platform";
import { AnnouncementBar } from "@/components/dash/AnnouncementBar";
import { getCurrentUser } from "@/lib/auth";
import { syncBadges } from "@/lib/data/badges";
import { syncCertificates } from "@/lib/data/certificates";
import { sendDueAnnouncements } from "@/lib/email/notify";

export const metadata = { title: "Learn" };

export default async function LearnDashboard() {
  const user = await getCurrentUser();
  // Sends any scheduled announcement whose time has passed (claimed once, so this is cheap when there's nothing due).
  after(sendDueAnnouncements);
  // Landing page after sign-in, so it also catches badges earned outside a lesson (e.g. Pioneer).
  const [mine, platform, profile, sessions, guide, features, quiz, catalog, campus] = await Promise.all([
    getMyCourses(),
    getPlatformSettings(),
    getLearnerProfile(user.id),
    sessionsFor(user.id, "learner"),
    getGuideState(user.id),
    featuresFor(user.roles),
    getQuizStats(),
    getCatalog(24),
    getCampusPulse(user.id),
    syncBadges(user.id),
    syncCertificates(user.id),
  ]);
  const active = mine.filter((c) => !c.completed);
  const [quizzes, quizCounts, checklist] = await Promise.all([
    getQuizzesToDo(active.map((c) => ({ id: c.id, title: c.title }))),
    quizProgress(
      user.id,
      mine.map((c) => c.id),
    ),
    guide.checklist_hidden ? Promise.resolve([]) : getChecklist(user.id, guide, features.campus !== false),
  ]);
  const quizTotal = [...quizCounts.values()].reduce((n, q) => n + q.quizzes, 0);
  const quizPassed = [...quizCounts.values()].reduce((n, q) => n + q.passed, 0);
  const now = new Date().toISOString();
  const soon = new Date(Date.parse(now) + 30 * 86400e3).toISOString();
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
  const booked = sessions.filter((s) => s.status === "confirmed" && s.endsAt > now).reverse();
  // Tasks: the next lesson, quizzes still to pass and booked sessions, then the getting-started steps.
  const at = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const tasks: Task[] = [
    ...(current ? [{ key: "continue", label: `Continue ${current.title}`, hint: `${current.lessonsLeft} ${current.lessonsLeft === 1 ? "lesson" : "lessons"} left`, href: `/learn/course/${current.id}`, done: false }] : []),
    ...quizzes.slice(0, 2).map((q) => ({ key: `quiz-${q.id}`, label: `Pass ${q.title}`, hint: q.courseTitle, href: `/learn/course/${q.courseId}/quiz/${q.id}`, done: false })),
    ...booked.slice(0, 2).map((b) => ({ key: `session-${b.id}`, label: `Session with ${b.other.name}`, hint: "1-on-1 coaching", when: at(b.startsAt), href: `/sessions/${b.id}`, done: false })),
    // Courses whose access ends within 30 days.
    ...active
      .filter((c) => c.expiresAt && !c.expired && c.expiresAt < soon)
      .map((c) => ({ key: `ends-${c.id}`, label: `Finish ${c.title}`, hint: "Access ends", when: at(c.expiresAt!), href: `/learn/course/${c.id}`, done: false })),
    ...checklist,
  ];
  // Overall progress across every enrolled course, for the banner.
  const totalLessons = mine.reduce((n, c) => n + c.lessonCount, 0);
  const lessonsDone = mine.reduce((n, c) => n + c.done, 0);
  const overall = totalLessons ? Math.round((lessonsDone / totalLessons) * 100) : 0;

  return (
    <div className="et-page et-home">
      <MobileHome
        name={(user.name || "there").split(" ")[0]}
        avatar={{ src: user.avatarUrl, seed: user.name || user.email }}
        inbox={features.campus === false && features.messages !== false ? "/learn/messages" : "/learn/announcements"}
        courses={active}
      />
      {platform.announcement && <AnnouncementBar text={platform.announcement.text} link={platform.announcement.link} />}
      <WelcomeHero
        name={(user.name || "there").split(" ")[0]}
        date={today}
        message={hero.message}
        cta={hero.cta}
        variant="strip"
        avatar={{ src: user.avatarUrl, seed: user.name || user.email }}
        stat={mine.length ? { value: overall, label: "Overall progress" } : null}
      />
      <LearnBoard
        current={current ?? null}
        weeks={profile?.heatmap.weeks ?? []}
        secondsLearned={profile?.stats.secondsLearned ?? 0}
        streak={profile?.heatmap.currentStreak ?? 0}
        quiz={quiz}
        quizzes={quizzes}
        quizTotal={quizTotal}
        quizPassed={quizPassed}
        tasks={tasks}
        campus={campus}
        campusOn={features.campus !== false}
        badges={(profile?.badges ?? []).map((b) => ({ id: b.id, label: BADGE_INFO[b.id]?.label ?? b.id }))}
        next={
          profile
            ? nextBadge({ joinedAt: profile.profile.joinedAt, lessonsDone, coursesCompleted: mine.filter((c) => c.completed).length, longestStreak: profile.heatmap.longestStreak })
            : null
        }
        available={catalog.filter((c) => !mine.some((m) => m.id === c.id)).slice(0, 8)}
      />
    </div>
  );
}
