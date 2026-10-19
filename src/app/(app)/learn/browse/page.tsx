import { CourseGrid } from "@/components/dash/CourseGrid";
import { Empty, PageHead } from "@/components/dash/ui";
import { getCatalog, getMyCourses, getSavedIds } from "@/lib/data/learn";
import { getRecommendations } from "@/lib/data/recommend";

export const metadata = { title: "Browse courses" };

export default async function Browse() {
  const [catalog, mine, savedIds, recommended] = await Promise.all([getCatalog(), getMyCourses(), getSavedIds(), getRecommendations(3)]);
  // Only worth a separate row when the ranking actually found matches.
  const picks = recommended.filter((c) => c.reason);
  const enrolledIds = new Set(mine.map((c) => c.id));

  return (
    <div className="et-page">
      <PageHead title="Browse courses" sub="Learn practical skills from instructors across Africa." />
      {picks.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recommended for you</h2>
          <CourseGrid courses={picks} enrolledIds={enrolledIds} savedIds={savedIds} />
          <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>All courses</h2>
        </>
      )}
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
