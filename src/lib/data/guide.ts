import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuide, type GuideState } from "@/lib/guide";

export async function getGuideState(userId: string): Promise<GuideState> {
  const { data, error } = await createAdminClient().from("profiles").select("guide_state").eq("id", userId).maybeSingle();
  // Before migration 0054 the column doesn't exist; treat that as a fresh start rather than breaking the app.
  if (error) return { tour: "pending-migration" };
  return readGuide(data?.guide_state);
}

export type ChecklistItem = { key: string; label: string; hint: string; href?: string; done: boolean };

// The getting-started card on the learner dashboard. Each step ticks itself off from real activity.
export async function getChecklist(userId: string, guide: GuideState, campus: boolean): Promise<ChecklistItem[]> {
  const db = createAdminClient();
  const [{ data: p }, { count: enrolled }, { count: lessons }, { count: posts }] = await Promise.all([
    db.from("profiles").select("username, avatar_url").eq("id", userId).maybeSingle(),
    db.from("enrollments").select("course_id", { count: "exact", head: true }).eq("user_id", userId),
    db.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", userId),
    campus ? db.from("campus_posts").select("id", { count: "exact", head: true }).eq("author_id", userId) : Promise.resolve({ count: 0 }),
  ]);
  return [
    { key: "tour", label: "Take the 1-minute tour", hint: "See where everything lives", done: !!guide.tour },
    { key: "photo", label: "Add a profile photo", hint: "Help instructors and classmates know you", href: "/settings", done: !!p?.avatar_url },
    { key: "enroll", label: "Enroll in your first course", hint: "Free and paid courses for your goals", href: "/learn/browse", done: !!enrolled },
    { key: "lesson", label: "Finish your first lesson", hint: "Your streak and badges start here", href: "/learn/courses", done: !!lessons },
    ...(campus ? [{ key: "campus", label: "Say hello on Campus", hint: "Introduce yourself to other learners", href: "/campus", done: !!posts }] : []),
  ];
}
