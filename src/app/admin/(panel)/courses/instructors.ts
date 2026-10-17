import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { usersWithRoles } from "@/lib/data/admin";

// Anyone who can own a course: tutors and super admins.
export async function getInstructorOptions(db: SupabaseClient<Database>) {
  const people = await usersWithRoles(db, ["tutor", "super_admin"]);
  return people.map((p) => ({ id: p.id, label: `${p.name}${p.roles.includes("tutor") ? "" : " (super admin)"}` }));
}
