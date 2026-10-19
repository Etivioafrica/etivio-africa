"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { after } from "next/server";
import { emailEnrolled } from "@/lib/email/notify";
import { createClient } from "@/lib/supabase/server";
import { syncBadges } from "@/lib/data/badges";
import { syncCertificates } from "@/lib/data/certificates";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

// Free courses only. RLS rejects anything else; paid enrollments are written after payment verification.
export async function enrollFree(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return;
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase.from("enrollments").insert({ user_id: userId, course_id: courseId });
  if (error && error.code !== "23505") throw new Error("Could not enroll in this course.");
  if (!error) after(() => emailEnrolled(userId, courseId));
  redirect(`/learn/course/${courseId}`);
}

export async function setLessonDone(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "");
  const done = formData.get("done") === "1";
  if (!lessonId) return;
  const { supabase, userId } = await requireUserId();
  if (done) {
    await supabase.from("lesson_progress").upsert({ user_id: userId, lesson_id: lessonId }, { ignoreDuplicates: true });
    // New badges are picked up by the shell's celebration on the next page.
    await Promise.all([syncBadges(userId), syncCertificates(userId)]);
  } else {
    await supabase.from("lesson_progress").delete().eq("user_id", userId).eq("lesson_id", lessonId);
  }
  const next = String(formData.get("next") ?? "");
  if (done && next.startsWith("/learn/")) redirect(next);
  refresh();
}

// ♡ on course cards: save or unsave a course for later.
export async function toggleSaved(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return;
  const { supabase, userId } = await requireUserId();
  if (formData.get("saved") === "1") await supabase.from("saved_courses").delete().eq("user_id", userId).eq("course_id", courseId);
  else await supabase.from("saved_courses").upsert({ user_id: userId, course_id: courseId }, { ignoreDuplicates: true });
  refresh();
}

// Lesson notes autosave from the player. Saving an empty note on an unbookmarked lesson removes the row.
export async function saveLessonNote(lessonId: string, body: string): Promise<{ ok: boolean }> {
  const { supabase, userId } = await requireUserId();
  const text = body.slice(0, 10000);
  const { error } = await supabase.from("lesson_notes").upsert({ user_id: userId, lesson_id: lessonId, body: text });
  if (!error && !text.trim()) await supabase.from("lesson_notes").delete().eq("user_id", userId).eq("lesson_id", lessonId).eq("bookmarked", false);
  return { ok: !error };
}

export async function setBookmark(lessonId: string, on: boolean): Promise<{ ok: boolean }> {
  const { supabase, userId } = await requireUserId();
  const { error } = await supabase.from("lesson_notes").upsert({ user_id: userId, lesson_id: lessonId, bookmarked: on });
  if (!error && !on) await supabase.from("lesson_notes").delete().eq("user_id", userId).eq("lesson_id", lessonId).eq("body", "");
  refresh();
  return { ok: !error };
}

export async function setWeeklyGoal(formData: FormData) {
  const goal = Number(formData.get("goal"));
  const { supabase, userId } = await requireUserId();
  await supabase
    .from("profiles")
    .update({ weekly_goal: Number.isInteger(goal) && goal >= 1 && goal <= 50 ? goal : null })
    .eq("id", userId);
  refresh();
}
