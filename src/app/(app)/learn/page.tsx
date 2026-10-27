import Link from "next/link";
import { ArrowRight, Award, BookOpen, Clock, Compass, Flame, ListChecks, PlayCircle, Store, Target } from "lucide-react";
import { Cover, Progress, Ring } from "@/components/dash/ui";
import { CourseGrid } from "@/components/dash/CourseGrid";
import { getCoursePlayer, getMyCourses, getSavedIds } from "@/lib/data/learn";
import { formatDuration } from "@/lib/format";
import { getLearnerPrefs, getRecommendations } from "@/lib/data/recommend";
import { getLearnerProfile } from "@/lib/data/profile";
import { GOAL_TIPS } from "@/components/dash/LearnerGuidance";
import { WelcomeHero } from "@/components/dash/WelcomeHero";
import { PhoneHome } from "@/components/dash/PhoneHome";
import { sessionsFor } from "@/lib/data/coaching";
import { getPlatformSettings } from "@/lib/platform";
import { AnnouncementBar } from "@/components/dash/AnnouncementBar";
import { getCurrentUser } from "@/lib/auth";
import { syncBadges } from "@/lib/data/badges";
import { syncCertificates } from "@/lib/data/certificates";
import { after } from "next/server";
import { sendDueAnnouncements } from "@/lib/email/notify";
import { GettingStarted } from "@/components/dash/GettingStarted";
import { getChecklist, getGuideState } from "@/lib/data/guide";
import { featuresFor } from "@/lib/data/features";

export const metadata = { title: "Learn" };

export default async function LearnDashboard() {
  const user = await getCurrentUser();
  // Sends any scheduled announcement whose time has passed (claimed once, so this is cheap when there's nothing due).
  after(sendDueAnnouncements);
  // Landing page after sign-in, so it also catches badges earned outside a lesson (e.g. Pioneer).
  const [mine, recommended, prefs, profile, savedIds, sessions] = await Promise.all([
    getMyCourses(),
    getRecommendations(3),
    getLearnerPrefs(),
    getLearnerProfile(user.id),
    getSavedIds(),
    sessionsFor(user.id, "learner"),
    syncBadges(user.id),
    syncCertificates(user.id),
  ]);
  const [platform, guide, features] = await Promise.all([getPlatformSettings(), getGuideState(user.id), featuresFor(user.roles)]);
  const checklist = guide.checklist_hidden ? [] : await getChecklist(user.id, guide, features.campus !== false);
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

  // The resume card names the exact lesson to pick up.
  const player = current ? await getCoursePlayer(current.id) : null;
  const upNext = player?.lessons.find((l) => !l.done) ?? null;
  const week = profile?.heatmap.weeks.at(-1) ?? [];
  const streak = profile?.heatmap.currentStreak ?? 0;
  const tip = prefs.goals[0] ? GOAL_TIPS[prefs.goals[0]] : null;
  const others = active.slice(current ? 1 : 0, 7);
  // Overall progress across every enrolled course, for the banner.
  const totalLessons = mine.reduce((n, c) => n + c.lessonCount, 0);
  const overall = totalLessons ? Math.round((lessonsDone / totalLessons) * 100) : 0;
  const now = new Date().toISOString();
  const upcoming = sessions.filter((s) => s.status === "confirmed" && s.endsAt > now).reverse();

  return (
    <div className="et-page et-home">
      {platform.announcement && <AnnouncementBar text={platform.announcement.text} link={platform.announcement.link} />}
      <WelcomeHero name={(user.name || "there").split(" ")[0]} date={today} message={hero.message} cta={hero.cta} background={platform.heroBgUrl}
        side={
          mine.length ? (
            <>
              <Ring value={overall} max={100} size={84}>
                <b>{overall}%</b>
              </Ring>
              <small>Overall progress</small>
            </>
          ) : null
        }
      />
      {checklist.length > 0 && <GettingStarted items={checklist} />}
      <PhoneHome
        current={current ?? null}
        upNext={upNext && player ? { id: upNext.id, title: upNext.title, index: player.lessons.indexOf(upNext) + 1 } : null}
        courses={[...active, ...completed]}
        week={week}
        thisWeek={thisWeek}
        goal={prefs.weeklyGoal || null}
        streak={streak}
        sessions={upcoming}
        interests={prefs.interests}
      />

      <div className="et-dash-top">
        {current ? (
          <section className="et-card et-dash-resume">
            <Link href={`/learn/course/${current.id}`} className="et-dash-resume-cover" aria-label={`Resume ${current.title}`}>
              <Cover url={current.coverUrl} />
              <span className="et-dash-play">
                <PlayCircle size={30} />
              </span>
            </Link>
            <div className="et-dash-resume-body">
              <span className="et-dash-eyebrow">{current.done ? "Pick up where you left off" : "Ready when you are"}</span>
              <h2>{current.title}</h2>
              <p className="et-muted">{current.instructor}</p>
              <Progress value={current.progress} label={`${current.progress}% complete`} />
              <p className="et-dash-left">
                {current.secondsLeft > 0 ? `${formatDuration(current.secondsLeft)} left` : `${current.lessonsLeft} ${current.lessonsLeft === 1 ? "lesson" : "lessons"} left`}
              </p>
              {upNext && (
                <p className="et-dash-next">
                  <PlayCircle size={15} /> <span>Up next:</span> <b>{upNext.title}</b>
                </p>
              )}
              <div className="et-inline">
                <Link href={upNext ? `/learn/course/${current.id}?lesson=${upNext.id}` : `/learn/course/${current.id}`} className="et-btn et-btn-primary">
                  {current.done ? "Resume" : "Start course"} <ArrowRight size={15} />
                </Link>
                <Link href={`/learn/browse/${current.id}`} className="et-btn et-btn-ghost">
                  Course details
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="et-card et-dash-start">
            <span className="et-cta-icon">
              <Compass size={24} />
            </span>
            <h2>{mine.length ? "You've finished everything you started" : "Start your first course"}</h2>
            <p>{mine.length ? "Pick your next skill. Your progress and certificates carry on from here." : "Courses, templates and guides from creators across Africa. Your progress, badges and certificates start here."}</p>
            <div className="et-inline">
              <Link href="/learn/browse" className="et-btn et-btn-primary">
                <BookOpen size={15} /> Browse courses
              </Link>
              <Link href="/learn/explore" className="et-btn et-btn-ghost">
                <Store size={15} /> Explore the marketplace
              </Link>
            </div>
            {prefs.interests.length > 0 && (
              <div className="et-dash-chips">
                <small>Your interests:</small>
                {prefs.interests.slice(0, 6).map((i) => (
                  <Link key={i} href={`/explore?q=${encodeURIComponent(i)}`}>
                    {i}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="et-card et-dash-week">
          <div className="et-dash-week-head">
            {prefs.weeklyGoal ? (
              <Ring value={thisWeek} max={prefs.weeklyGoal} size={76}>
                <b style={{ fontSize: 17 }}>{thisWeek}</b>
                <small>of {prefs.weeklyGoal}</small>
              </Ring>
            ) : (
              <span className="et-set-icon et-dash-goal-icon">
                <Target size={22} />
              </span>
            )}
            <div>
              <b>
                {!prefs.weeklyGoal
                  ? "Set a weekly goal"
                  : thisWeek >= prefs.weeklyGoal
                    ? "Weekly goal reached!"
                    : `${prefs.weeklyGoal - thisWeek} ${prefs.weeklyGoal - thisWeek === 1 ? "lesson" : "lessons"} to go this week`}
              </b>
              <small>{prefs.weeklyGoal ? "Resets every Sunday." : <Link href="/profile">Choose 3, 5 or 7 lessons a week</Link>}</small>
            </div>
          </div>

          <div className="et-dash-days" aria-label="This week">
            {week.map((d, i) => (
              <span key={d.date} className={`${d.count ? "is-on" : ""}${d.future ? " is-future" : ""}`} title={`${d.date}: ${d.count} ${d.count === 1 ? "lesson" : "lessons"}`}>
                <i>{d.count ? <Flame size={13} /> : null}</i>
                <small>{"SMTWTFS"[i]}</small>
              </span>
            ))}
          </div>

          <ul className="et-dash-mini">
            <li>
              <Flame size={16} />
              <b>{streak}</b>
              <small>day streak</small>
            </li>
            <li>
              <ListChecks size={16} />
              <b>{lessonsDone}</b>
              <small>lessons done</small>
            </li>
            <li>
              <Clock size={16} />
              <b>{formatDuration(profile?.stats.secondsLearned ?? 0) || "0 min"}</b>
              <small>learned</small>
            </li>
            <li>
              <Award size={16} />
              <b>{completed.length}</b>
              <small>{completed.length === 1 ? "certificate" : "certificates"}</small>
            </li>
          </ul>

          {tip && (
            <p className="et-dash-tip">
              {tip.tip} <Link href={tip.cta.href}>{tip.cta.label}</Link>
            </p>
          )}
        </section>
      </div>

      {others.length > 0 && (
        <section className="et-dash-section is-desk">
          <div className="et-dash-head">
            <h2>Also in progress</h2>
            <Link href="/learn/courses">My courses</Link>
          </div>
          <div className="et-dash-row">
            {others.map((c) => (
              <Link key={c.id} href={`/learn/course/${c.id}`} className="et-card et-dash-mini-course">
                <Cover url={c.coverUrl} />
                <div>
                  <b>{c.title}</b>
                  <Progress value={c.progress} label={`${c.done}/${c.lessonCount}`} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recommended.length > 0 && (
        <section className="et-dash-section">
          <div className="et-dash-head">
            <div>
              <h2>{prefs.interests.length || prefs.level ? "Recommended for you" : "Popular on Etivio"}</h2>
              {(prefs.interests.length > 0 || prefs.level) && (
                <p className="et-muted">
                  Based on your interests{prefs.level ? " and level" : ""}. <Link href="/settings">Update interests</Link>
                </p>
              )}
            </div>
            <Link href="/learn/browse">Browse all</Link>
          </div>
          <CourseGrid courses={recommended} enrolledIds={enrolledIds} savedIds={savedIds} />
        </section>
      )}

      {completed.length > 0 && (
        <section className="et-dash-section is-desk">
          <div className="et-dash-head">
            <h2>Completed</h2>
            <Link href="/profile/certificates">Your certificates</Link>
          </div>
          <div className="et-dash-row">
            {completed.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/learn/course/${c.id}`} className="et-card et-dash-done">
                <Cover url={c.coverUrl} small />
                <div>
                  <b>{c.title}</b>
                  <small>
                    <Award size={13} /> Certificate earned
                  </small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
