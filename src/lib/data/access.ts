import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// After granting courses: anyone whose access had run out gets a fresh period from now. New enrolments get their end
// date from the database when they're created; this covers buying (or being given) a course again.
export async function renewAccess(userId: string, courseIds: string[]) {
  if (!courseIds.length) return;
  await createAdminClient().rpc("renew_enrollments", { p_user_id: userId, p_course_ids: courseIds });
}
