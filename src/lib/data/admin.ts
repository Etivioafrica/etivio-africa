import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

export const EVENT_LABELS: Record<string, string> = {
  signup: "signed up",
  enroll: "enrolled in",
  lesson_complete: "completed a lesson in",
  course_published: "published",
  page_view: "viewed",
};

export type FeedItem = { id: number; type: string; at: string; who: string; userId: string | null; course: string | null; path: string | null };

// Recent activity with names resolved. Page views are excluded unless asked for.
export async function getActivityFeed(db: DB, limit = 12, includeViews = false): Promise<FeedItem[]> {
  let q = db
    .from("activity_events")
    .select("id, type, created_at, path, user_id, user:profiles!activity_events_user_id_fkey(full_name), course:courses!activity_events_course_id_fkey(title)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!includeViews) q = q.neq("type", "page_view");
  const { data } = await q;
  return (data ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    at: e.created_at,
    userId: e.user_id,
    who: e.user?.full_name || "Someone",
    course: e.course?.title ?? null,
    path: e.path,
  }));
}

// Names for a set of profile ids, for tables that store bare ids.
export async function profileNames(db: DB, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (!unique.length) return new Map<string, string>();
  const { data } = await db.from("profiles").select("id, full_name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.full_name || "Unnamed"]));
}

export const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const monthLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
