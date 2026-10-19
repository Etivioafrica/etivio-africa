import { Suspense } from "react";
import { CategoryManager } from "@/components/dash/CategoryManager";
import { requireAdmin } from "@/lib/admin";
import { getCourseCategories } from "@/lib/data/courses-admin";
import { addCourseCategory, deleteCourseCategory } from "../actions";

export const metadata = { title: "Course categories" };

export default function CourseCategories() {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 360 }} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const { db } = await requireAdmin("courses");
  const [categories, { data: used }] = await Promise.all([getCourseCategories(), db.from("courses").select("category_id")]);
  const counts: Record<string, number> = {};
  for (const u of used ?? []) if (u.category_id) counts[u.category_id] = (counts[u.category_id] ?? 0) + 1;
  return (
    <CategoryManager
      categories={categories}
      counts={counts}
      noun="course"
      help="Main categories group the catalog and power recommendations: a learner who picked “Design” in the welcome guide sees Design courses first. Open a category to add subcategories, then choose one on each course under Settings."
      addCategory={addCourseCategory}
      deleteCategory={deleteCourseCategory}
    />
  );
}
