import { CourseGrid } from "@/components/dash/CourseGrid";
import { Empty, PageHead } from "@/components/dash/ui";
import { getCatalog, getMyCourses } from "@/lib/data/learn";

export const metadata = { title: "Browse courses" };

export default async function Browse() {
  const [catalog, mine] = await Promise.all([getCatalog(), getMyCourses()]);
  const enrolledIds = new Set(mine.map((c) => c.id));

  return (
    <div className="et-page">
      <PageHead title="Browse courses" sub="Learn practical skills from instructors across Africa." />
      {catalog.length ? (
        <CourseGrid courses={catalog} enrolledIds={enrolledIds} />
      ) : (
        <section className="et-card">
          <Empty title="No courses published yet" action={{ href: "/teach", label: "Teach a course" }}>
            Be the first to publish one.
          </Empty>
        </section>
      )}
    </div>
  );
}
