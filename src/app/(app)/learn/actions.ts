"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  redirect(`/learn/course/${courseId}`);
}

export async function setLessonDone(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "");
  const done = formData.get("done") === "1";
  if (!lessonId) return;
  const { supabase, userId } = await requireUserId();
  if (done) {
    await supabase.from("lesson_progress").upsert({ user_id: userId, lesson_id: lessonId }, { ignoreDuplicates: true });
  } else {
    await supabase.from("lesson_progress").delete().eq("user_id", userId).eq("lesson_id", lessonId);
  }
  const next = String(formData.get("next") ?? "");
  if (done && next.startsWith("/learn/")) redirect(next);
  refresh();
}
