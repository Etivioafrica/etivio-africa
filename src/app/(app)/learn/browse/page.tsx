import { CourseGrid } from "@/components/dash/CourseGrid";
import { Empty, PageHead } from "@/components/dash/ui";
import { getCatalog, getMyCourses, getSavedIds } from "@/lib/data/learn";

export const metadata = { title: "Browse courses" };

export default async function Browse() {
  const [catalog, mine, savedIds] = await Promise.all([getCatalog(), getMyCourses(), getSavedIds()]);
  const enrolledIds = new Set(mine.map((c) => c.id));

  return (
    <div className="et-page">
      <PageHead title="Browse courses" sub="Learn practical skills from instructors across Africa." />
      {catalog.length ? (
        <CourseGrid courses={catalog} enrolledIds={enrolledIds} savedIds={savedIds} />
      ) : (
        <section className="et-card">
          <Empty title="No courses published yet">
            New courses are on the way. Check back soon.
          </Empty>
        </section>
      )}
    </div>
  );
}
