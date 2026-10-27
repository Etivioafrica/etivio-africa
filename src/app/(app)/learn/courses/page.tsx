import { CourseTiles } from "@/components/dash/CourseTiles";
import { Empty, PageHead } from "@/components/dash/ui";
import { progressOf } from "@/lib/course-tiles";
import { getMyCourses } from "@/lib/data/learn";

export const metadata = { title: "My courses" };

export default async function MyCourses() {
  const mine = await getMyCourses();
  const tiles = mine.map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    coverUrl: c.coverUrl,
    // Expired access goes to the course page, where they can buy (or enrol) again.
    href: c.expired ? `/learn/browse/${c.id}` : `/learn/course/${c.id}`,
    tags: [c.expired ? "expired" : c.completed ? "completed" : c.progress > 0 ? "in-progress" : "not-started"],
    tagline: c.category,
    progress: progressOf(c),
  }));

  return (
    <div className="et-page">
      <PageHead title="My courses" sub={`${mine.length} course${mine.length === 1 ? "" : "s"} in your library. Pick up where you left off.`} />
      <CourseTiles
        tiles={tiles}
        filters={[
          { key: "in-progress", label: "In progress" },
          { key: "not-started", label: "Not started" },
          { key: "completed", label: "Completed" },
          ...(mine.some((c) => c.expired) ? [{ key: "expired", label: "Access ended" }] : []),
        ]}
        empty={
          <section className="et-card">
            <Empty title="Your library is empty" action={{ href: "/learn/browse", label: "Browse courses" }}>
              Courses you enroll in will appear here.
            </Empty>
          </section>
        }
      />
    </div>
  );
}
