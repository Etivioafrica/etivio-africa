import Link from "next/link";
import { Cover, Empty, PageHead, Progress, Status } from "@/components/dash/ui";
import { getMyCourses } from "@/lib/data/learn";
import { formatDate } from "@/lib/format";

export const metadata = { title: "My courses" };

export default async function MyCourses() {
  const mine = await getMyCourses();

  return (
    <div className="et-page">
      <PageHead title="My courses" sub={`${mine.length} course${mine.length === 1 ? "" : "s"} in your library.`} />
      {mine.length ? (
        <div className="et-course-grid">
          {mine.map((c) => (
            <Link key={c.id} href={`/learn/course/${c.id}`} className="et-card et-course">
              <Cover url={c.coverUrl} level={c.level} />
              <div className="et-course-body">
                <h3>{c.title}</h3>
                <p>{c.instructor}</p>
                <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  <Progress value={c.progress} />
                  <div className="et-course-meta" style={{ paddingTop: 0 }}>
                    <span>Enrolled {formatDate(c.enrolledAt)}</span>
                    <Status value={c.completed ? "completed" : "in progress"} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <section className="et-card">
          <Empty title="Your library is empty" action={{ href: "/learn/browse", label: "Browse courses" }}>
            Courses you enroll in will appear here.
          </Empty>
        </section>
      )}
    </div>
  );
}
