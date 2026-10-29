import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, Award, BookOpen, ChevronRight, CircleHelp, Clock, Medal, MessagesSquare, Star } from "lucide-react";
import { Avatar } from "./Avatar";
import { QuizWithAi, TasksCard, type Task } from "./LearnBoardClient";
import { formatDuration, formatPrice } from "@/lib/format";
import type { CourseCard, MyCourse } from "@/lib/data/learn";
import type { BadgeStatus } from "@/lib/badges";
import { Progress } from "./ui";
import type { HeatCell } from "@/lib/activity";
import type { CampusPulse, QuizStats, QuizToDo } from "@/lib/data/dashboard";

type Props = {
  current: MyCourse | null;
  weeks: HeatCell[][];
  secondsLearned: number;
  streak: number;
  quiz: QuizStats;
  quizzes: QuizToDo[];
  quizTotal: number;
  quizPassed: number;
  tasks: Task[];
  campus: CampusPulse;
  campusOn: boolean;
  badges: { id: string; label: string }[];
  next: BadgeStatus | null;
  available: CourseCard[];
};

const TONES = ["#2563eb", "#16a34a", "#7c3aed", "#ea580c", "#e11d48", "#0891b2"];

// The learner dashboard under the banner: activity, time learning, badges and Campus across the top, then the course to continue,
// quizzes and the learner's tasks, then courses they can take next.
export function LearnBoard(p: Props) {
  const week = p.weeks.at(-1) ?? [];
  const today = week.findLast((d) => !d.future);
  const streak = p.streak;
  const days = p.weeks.flat().filter((d) => !d.future).slice(-14);
  const peak = Math.max(1, ...days.map((d) => d.count));
  const thisWeek = week.reduce((n, d) => n + d.count, 0);
  const lastWeek = (p.weeks.at(-2) ?? []).reduce((n, d) => n + d.count, 0);
  const change = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
  const avgPerDay = days.length ? days.reduce((n, d) => n + d.count, 0) / days.length : 0;

  return (
    <div className="et-lb">
      {/* Row 1: summaries */}
      <section className="et-card et-lb-card et-lb-activity">
        <div className="et-lb-head is-plain">
          <h3>Activity</h3>
          <small>
            {p.weeks.flat().reduce((n, d) => n + d.count, 0)} lessons · {streak} day streak
          </small>
        </div>
        <div className="et-lb-hm" role="img" aria-label={`Lessons finished each day. Current streak: ${streak} days.`}>
          {p.weeks.slice(-30).map((w) => (
            <span key={w[0].date}>
              {w.map((d) => (
                <i key={d.date} className={d.future ? "is-future" : `l${d.level}`} title={d.future ? undefined : `${d.date}: ${d.count} ${d.count === 1 ? "lesson" : "lessons"}`} />
              ))}
            </span>
          ))}
        </div>
        <div className="et-lb-hm-key">
          <small>Less</small>
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={`l${l}`} />
          ))}
          <small>More</small>
        </div>
      </section>

      <section className="et-card et-lb-card et-lb-time">
        <h3>Total time learning</h3>
        <p className="et-lb-big">
          {formatDuration(p.secondsLearned) || "0 min"}
          {!!change && (
            <span className={`et-lb-delta${change < 0 ? " is-down" : ""}`}>
              {change < 0 ? <ArrowDown size={13} /> : <ArrowUp size={13} />} {Math.abs(change)}%
            </span>
          )}
        </p>
        <div className="et-lb-spark" role="img" aria-label={`Lessons per day over the last 14 days. ${thisWeek} this week.`}>
          <i className="et-lb-avg" style={{ bottom: `${(avgPerDay / peak) * 100}%` }} />
          {days.map((d) => (
            <span key={d.date} title={`${d.date}: ${d.count} ${d.count === 1 ? "lesson" : "lessons"}`} className={d === today ? "is-today" : d.count ? "is-on" : ""} style={{ height: `${Math.max(8, (d.count / peak) * 100)}%` }} />
          ))}
        </div>
        <small className="et-lb-foot">
          {thisWeek} {thisWeek === 1 ? "lesson" : "lessons"} this week{change !== null ? ` vs ${lastWeek} last week` : ""}
        </small>
      </section>

      <section className="et-card et-lb-card et-lb-badges">
        <div className="et-lb-head is-plain">
          <h3>Badges</h3>
          <Link href="/profile/badges">{p.badges.length} earned</Link>
        </div>
        {p.badges.length ? (
          <div className="et-lb-badge-row">
            {p.badges.slice(0, 3).map((b) => (
              <span key={b.id} title={b.label}>
                <Award size={16} />
                {b.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="et-lb-quiet">Finish your first lesson to earn a badge.</p>
        )}
        {p.next && (
          <div className="et-lb-next">
            <span className="et-lb-icon is-sm" style={{ background: "#ca8a04" }}>
              <Medal size={14} />
            </span>
            <span>
              <small>Next: {p.next.badge.label}</small>
              <Progress value={Math.round((p.next.current / p.next.target) * 100)} label={`${p.next.current}/${p.next.target} ${p.next.unit}`} />
            </span>
          </div>
        )}
      </section>

      <section className="et-card et-lb-card et-lb-campus">
        <div className="et-lb-head is-plain">
          <h3>Campus</h3>
          <span className="et-lb-live">
            <i /> {p.campus.postsToday} {p.campus.postsToday === 1 ? "post" : "posts"} today
          </span>
        </div>
        <div className="et-lb-head is-plain">
          <small>Active communities</small>
        </div>
        {p.campus.communities.length ? (
          <ul className="et-lb-comm">
            {p.campus.communities.map((c, i) => (
              <li key={c.id}>
                <Link href={`/communities/${c.slug}`}>
                  <span className="et-lb-icon is-sm" style={{ background: TONES[i % TONES.length] }}>
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <b>{c.name}</b>
                  <small>{c.posts ? `${c.posts} new` : `${c.members} ${c.members === 1 ? "member" : "members"}`}</small>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="et-lb-quiet">No communities yet.</p>
        )}
        <Link href={p.campusOn ? "/campus" : "/communities"} className="et-lb-campus-btn">
          <MessagesSquare size={16} /> {p.campusOn ? "Visit Campus" : "See communities"} <ArrowRight size={15} />
        </Link>
      </section>

      {/* Rows 2 and 3: the work area, with tasks down the right */}
      <section className="et-card et-lb-card et-lb-continue-wrap">
        <div className="et-lb-head is-plain">
          <h3>Continue learning</h3>
        </div>
        {p.current ? (
          <Link href={`/learn/course/${p.current.id}`} className="et-lb-course">
            <span className="et-lb-course-main">
              <span className="et-lb-icon is-lg">
                <BookOpen size={20} />
              </span>
              <span>
                <b>{p.current.title}</b>
                <small>
                  <Clock size={13} /> {p.current.secondsLeft > 0 ? `${formatDuration(p.current.secondsLeft)} left` : `${p.current.lessonsLeft} lessons left`} ·{" "}
                  {p.current.lessonCount} {p.current.lessonCount === 1 ? "lesson" : "lessons"}
                </small>
              </span>
            </span>
            <Progress value={p.current.progress} />
            <span className="et-lb-course-foot">
              <span className="et-lb-course-tutor">
                <Avatar src={null} initial={p.current.instructor.charAt(0)} seed={p.current.instructor} className="et-lb-tutor-av" />
                <span>
                  <small>Tutor</small>
                  <b>{p.current.instructor}</b>
                </span>
              </span>
              <span className="et-lb-resume">
                {p.current.done ? "Resume" : "Start"} <ArrowRight size={15} />
              </span>
            </span>
          </Link>
        ) : (
          <Link href="/learn/browse" className="et-lb-course is-empty">
            <BookOpen size={22} />
            <b>Start your first course</b>
            <small>Browse courses from creators across Africa.</small>
          </Link>
        )}
      </section>

      <section className="et-card et-lb-card et-lb-quiz-wrap">
        <div className="et-lb-head is-plain">
          <h3>Quizzes</h3>
        </div>
        {p.quizTotal ? (
          <div className="et-lb-quiz">
            <div className="et-lb-quiz-sum">
              <p className="et-lb-big">
                {p.quizPassed}
                <small> / {p.quizTotal}</small>
              </p>
              <small>quizzes passed</small>
              <div className="et-lb-quiz-pills">
                <span>
                  <b>{p.quiz.taken ? `${p.quiz.average}%` : "0%"}</b> avg
                </span>
                <span>
                  <b>{p.quiz.highest}%</b> best
                </span>
                <span>
                  <b>{Math.max(0, p.quizTotal - p.quizPassed)}</b> left
                </span>
              </div>
            </div>
            <ul className="et-lb-quiz-list">
              {p.quizzes.length ? (
                p.quizzes.slice(0, 2).map((q, i) => (
                  <li key={q.id}>
                    <Link href={`/learn/course/${q.courseId}/quiz/${q.id}`} className={i === 0 ? "is-next" : ""}>
                      <span className="et-lb-icon" style={{ background: TONES[i % TONES.length] }}>
                        <CircleHelp size={16} />
                      </span>
                      <span>
                        <b>{q.title}</b>
                        <small>
                          {q.questions} questions · pass {q.passMark}%
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </Link>
                  </li>
                ))
              ) : (
                <li className="et-lb-quiet">{p.quizTotal ? "You've passed every quiz in your courses." : "Your courses don't have quizzes yet."}</li>
              )}
            </ul>
          </div>
        ) : (
          <div className="et-lb-quiz is-empty">
            <span className="et-lb-icon is-lg" style={{ background: "#7c3aed" }}>
              <CircleHelp size={20} />
            </span>
            <div>
              <b>No quizzes yet</b>
              <p>Quizzes show up at the end of course modules. Until then, practise with questions on what you&apos;ve learned.</p>
              <QuizWithAi />
            </div>
          </div>
        )}
      </section>

      <TasksCard tasks={p.tasks} />

      <section className="et-card et-lb-card et-lb-avail">
        <div className="et-lb-head is-plain">
          <h3>Available courses</h3>
          <Link href="/learn/browse">Browse all</Link>
        </div>
        {p.available.length ? (
          <div className="et-lb-avail-row">
            {p.available.map((c) => (
              <Link key={c.id} href={`/learn/browse/${c.id}`} className="et-lb-avail-item">
                <span className="et-lb-avail-cover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.coverUrl ? <img src={c.coverUrl} alt="" /> : <BookOpen size={24} />}
                  <em>{c.level}</em>
                </span>
                <b>{c.title}</b>
                <small>
                  {c.instructor} · {c.lessonCount} {c.lessonCount === 1 ? "lesson" : "lessons"}
                </small>
                <span className="et-lb-avail-foot">
                  <strong>{formatPrice(c.priceMinor, c.currency)}</strong>
                  {!!c.rating && (
                    <span>
                      <Star size={12} fill="currentColor" /> {c.rating.toFixed(1)}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="et-lb-quiet">You&apos;re enrolled in every course on Etivio. New ones show up here.</p>
        )}
      </section>
    </div>
  );
}
