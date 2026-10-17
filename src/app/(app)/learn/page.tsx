import Link from "next/link";
import { BookOpen, CheckCircle2, Flame, ListChecks } from "lucide-react";
import { Cover, Empty, PageHead, Progress, Stat } from "@/components/dash/ui";
import { CourseGrid } from "@/components/dash/CourseGrid";
import { getCatalog, getMyCourses } from "@/lib/data/learn";

export const metadata = { title: "Learn" };

export default async function LearnDashboard() {
  const [mine, catalog] = await Promise.all([getMyCourses(), getCatalog(12)]);
  const active = mine.filter((c) => !c.completed);
  const completed = mine.filter((c) => c.completed);
  const lessonsDone = mine.reduce((n, c) => n + c.done, 0);
  const enrolledIds = new Set(mine.map((c) => c.id));
  const suggestions = catalog.filter((c) => !enrolledIds.has(c.id)).slice(0, 3);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="et-page">
      <PageHead title="Dashboard" sub="Pick up where you left off.">
        <span className="et-date">{today}</span>
      </PageHead>

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

      {suggestions.length > 0 && (
        <section className="et-page" style={{ gap: 14 }}>
          <div className="et-toolbar">
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Explore courses</h2>
            <Link href="/learn/browse" className="et-btn et-btn-ghost et-btn-sm">
              Browse all
            </Link>
          </div>
          <CourseGrid courses={suggestions} enrolledIds={enrolledIds} />
        </section>
      )}
    </div>
  );
}
