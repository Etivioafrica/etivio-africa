import "server-only";
import { renewAccess } from "@/lib/data/access";
import { createAdminClient } from "@/lib/supabase/admin";

// Not a server action on purpose: only trusted server code (free claims, verified payments, admins) may grant access.
// Gives someone a product (and, for a bundle, everything in it). Used for free items now and by checkout later.
export async function grantProduct(userId: string, productId: string, paymentId: string | null = null) {
  const db = createAdminClient();
  await db.from("product_access").upsert({ user_id: userId, product_id: productId, payment_id: paymentId }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
  const { data: items } = await db.from("bundle_items").select("course_id, product_id").eq("bundle_id", productId);
  const courses = (items ?? []).flatMap((i) => (i.course_id ? [i.course_id] : []));
  const products = (items ?? []).flatMap((i) => (i.product_id ? [i.product_id] : []));
  if (courses.length) {
    await db.from("enrollments").upsert(courses.map((course_id) => ({ user_id: userId, course_id })), { onConflict: "user_id,course_id", ignoreDuplicates: true });
    await renewAccess(userId, courses);
  }
  if (products.length)
    await db.from("product_access").upsert(products.map((product_id) => ({ user_id: userId, product_id, payment_id: paymentId })), { onConflict: "user_id,product_id", ignoreDuplicates: true });
}
