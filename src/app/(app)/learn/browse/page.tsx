import { CourseTiles } from "@/components/dash/CourseTiles";
import { Empty, PageHead } from "@/components/dash/ui";
import { catalogTile } from "@/lib/course-tiles";
import { getCatalog, getMyCourses, getSavedIds } from "@/lib/data/learn";
import { getRecommendations } from "@/lib/data/recommend";

export const metadata = { title: "Browse courses" };

export default async function Browse() {
  const [catalog, mine, savedIds, recommended] = await Promise.all([getCatalog(), getMyCourses(), getSavedIds(), getRecommendations(12)]);
  // "For you" only lists courses the ranking actually matched to the learner.
  const reasons = new Map(recommended.filter((c) => c.reason).map((c) => [c.id, c.reason]));
  const forYou = new Set(reasons.keys());
  const myCourses = new Map(mine.map((c) => [c.id, c]));
  const tiles = catalog.map((c) => catalogTile({ ...c, reason: reasons.get(c.id) ?? null }, myCourses, savedIds, forYou));

  return (
    <div className="et-page">
      <PageHead title="Browse courses" sub="Learn practical skills from instructors across Africa." />
      <CourseTiles
        tiles={tiles}
        filters={[
          ...(forYou.size ? [{ key: "for-you", label: "For you" }] : []),
          { key: "beginner", label: "Beginner" },
          { key: "intermediate", label: "Intermediate" },
          { key: "advanced", label: "Advanced" },
        ]}
        empty={
          <section className="et-card">
            <Empty title="No courses published yet">New courses are on the way. Check back soon.</Empty>
          </section>
        }
      />
    </div>
  );
}
