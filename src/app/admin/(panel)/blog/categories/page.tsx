import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { getCategories } from "@/lib/data/blog";
import { CategoryManager } from "@/components/dash/CategoryManager";
import { addCategory, deleteCategory } from "../actions";

export const metadata = { title: "Blog categories" };

export default function BlogCategories() {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 360 }} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const { db } = await requireAdmin("blog");
  const [categories, { data: used }] = await Promise.all([getCategories(), db.from("blog_post_categories").select("category_id")]);
  const counts: Record<string, number> = {};
  for (const u of used ?? []) counts[u.category_id] = (counts[u.category_id] ?? 0) + 1;
  return (
    <CategoryManager
      categories={categories}
      counts={counts}
      noun="post"
      help="Add main categories first, then open one to add subcategories under it. When you write a post you can tick as many as fit. On the blog, readers filter by main category, and that includes its subcategories."
      addCategory={addCategory}
      deleteCategory={deleteCategory}
    />
  );
}
