import Link from "next/link";
import { ArrowRight, Compass, Flame, Video } from "lucide-react";
import { Ring } from "@/components/dash/ui";
import type { MyCourse } from "@/lib/data/learn";
import type { SessionRow } from "@/lib/data/coaching";
import "./phone-home.css";

// The phone app's home under the Hello banner: the course to continue with this week's goal tucked under it, your
// courses with progress rings, and coaching sessions coming up. Desktop keeps the full dashboard; CSS shows one or the other.

// Session times are shown in West Africa time, the platform default (server-rendered, so there's no device clock here).
const TZ = "Africa/Lagos";
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-GB", { timeZone: TZ, ...o });

const TILES = ["#bbf7d0", "#fde68a", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fed7aa"];

const initials = (title: string) =>
  title
    .split(/[\s-]+/)
    .filter((w) => /^[a-z0-9]/i.test(w) && !["to", "and", "of", "the", "for", "a", "in"].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || title.slice(0, 2).toUpperCase();

type Day = { date: string; count: number; future?: boolean };

export function PhoneHome({
  current,
  upNext,
  courses,
  week,
  thisWeek,
  goal,
  streak,
  sessions,
}: {
  current: MyCourse | null;
  upNext: { id: string; title: string; index: number } | null;
  courses: MyCourse[];
  week: Day[];
  thisWeek: number;
  goal: number | null;
  streak: number;
  sessions: SessionRow[];
}) {
  const left = goal ? Math.max(0, goal - thisWeek) : 0;
  return (
    <div className="et-ph">
      <section className="et-ph-stack">
        {current ? (
          <div className="et-ph-now">
            <div className="et-ph-now-top">
              <span className="et-ph-now-tile">{initials(current.title)}</span>
              <div>
                <b>{current.title}</b>
                <small>
                  {upNext ? `Lesson ${upNext.index} of ${current.lessonCount} · ${upNext.title}` : `${current.lessonCount} ${current.lessonCount === 1 ? "lesson" : "lessons"}`}
                </small>
              </div>
            </div>
            <div className="et-ph-now-foot">
              <span className="et-ph-bar" aria-label={`${current.progress}% complete`}>
                <i style={{ width: `${current.progress}%` }} />
              </span>
              <em>{current.progress}%</em>
              <Link href={upNext ? `/learn/course/${current.id}?lesson=${upNext.id}` : `/learn/course/${current.id}`} className="et-ph-go">
                {current.done ? "Continue" : "Start"}
              </Link>
            </div>
          </div>
        ) : (
          <div className="et-ph-now">
            <div className="et-ph-now-top">
              <span className="et-ph-now-tile">
                <Compass size={20} />
              </span>
              <div>
                <b>{courses.length ? "Ready for your next course?" : "Start your first course"}</b>
                <small>Courses from creators across Africa</small>
              </div>
            </div>
            <div className="et-ph-now-foot is-end">
              <Link href="/learn/browse" className="et-ph-go">
                Browse courses
              </Link>
            </div>
          </div>
        )}

        <div className="et-ph-goal">
          <div className="et-ph-goal-head">
            <b>{!goal ? "Set a weekly goal" : left ? `${left} more ${left === 1 ? "lesson" : "lessons"} this week` : "Weekly goal reached"}</b>
            {goal ? (
              <span className="et-ph-chip">
                <Flame size={13} /> {streak} day{streak === 1 ? "" : "s"}
              </span>
            ) : (
              <Link href="/profile" className="et-ph-goal-set">
                Set goal
              </Link>
            )}
          </div>
          <p>{goal ? `${thisWeek} of ${goal} lessons done. Resets every Sunday.` : "Pick 3, 5 or 7 lessons a week and we'll keep count."}</p>
          <div className="et-ph-days" aria-label="This week">
            {week.map((d, i) => (
              <span key={d.date} className={`${d.count ? "is-on" : ""}${d.future ? " is-future" : ""}`}>
                {"SMTWTFS"[i]}
              </span>
            ))}
          </div>
        </div>
      </section>

      {courses.length > 0 && (
        <section className="et-ph-card">
          <div className="et-ph-head">
            <h2>My courses</h2>
            <Link href="/learn/courses">See all</Link>
          </div>
          <ul className="et-ph-list">
            {courses.slice(0, 4).map((c, i) => (
              <li key={c.id}>
                <Link href={`/learn/course/${c.id}`}>
                  <span className="et-ph-tile" style={{ background: TILES[i % TILES.length] }}>
                    {initials(c.title)}
                  </span>
                  <div className="et-ph-text">
                    <b>{c.title}</b>
                    <small>{c.instructor}</small>
                  </div>
                  <Ring value={c.progress} max={100} size={38}>
                    <small className="et-ph-pct">{c.progress}</small>
                  </Ring>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sessions.length > 0 && (
        <section className="et-ph-card">
          <div className="et-ph-head">
            <h2>Upcoming sessions</h2>
            <Link href="/learn/sessions">See all</Link>
          </div>
          <ul className="et-ph-list">
            {sessions.slice(0, 3).map((s) => {
              const at = new Date(s.startsAt);
              return (
                <li key={s.id}>
                  <Link href={`/sessions/${s.id}`}>
                    <span className="et-ph-date">
                      <b>{fmt(at, { day: "numeric" })}</b>
                      <small>{fmt(at, { month: "short" })}</small>
                    </span>
                    <div className="et-ph-text">
                      <b>Session with {s.other.name}</b>
                      <small>
                        {fmt(at, { weekday: "long" })} at {fmt(at, { hour: "2-digit", minute: "2-digit" })}
                      </small>
                    </div>
                    <span className="et-ph-icon">
                      <Video size={16} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!courses.length && (
        <Link href="/learn/explore" className="et-ph-explore">
          Explore the marketplace <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
