import "server-only";
import { requireAdmin } from "@/lib/admin";
import { usersWithRoles } from "@/lib/data/admin";
import { getCategories } from "@/lib/data/blog";
export { toHtml } from "@/lib/blog";

export async function editorContext() {
  const { admin, db } = await requireAdmin("blog");
  const [categories, authors] = await Promise.all([getCategories(), usersWithRoles(db, ["super_admin", "editor", "tutor"])]);
  return { admin, db, categories, authors: authors.map(({ id, name }) => ({ id, name })) };
}
