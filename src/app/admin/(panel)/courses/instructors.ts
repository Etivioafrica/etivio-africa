import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Anyone who can own a course.
export async function getInstructorOptions(db: SupabaseClient<Database>) {
  const { data } = await db
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["instructor", "admin", "super_admin"])
    .order("full_name");
  return (data ?? []).map((p) => ({ id: p.id, label: `${p.full_name || "Unnamed"}${p.role === "instructor" ? "" : ` (${p.role.replace("_", " ")})`}` }));
}
