"use server";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCoursePlayer } from "@/lib/data/learn";
import { syncBadges } from "@/lib/data/badges";
import { syncCertificates } from "@/lib/data/certificates";
import { moderate } from "@/lib/moderation";

export type QuizResult = {
  error?: string;
  score?: number;
  passed?: boolean;
  passMark?: number;
  results?: { chosen: number; correct: number; explanation: string | null }[];
};

async function userId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Grades on the server so the right answers never reach the browser before submitting.
export async function submitQuiz(courseId: string, quizId: string, answers: number[]): Promise<QuizResult> {
  const uid = await userId();
  if (!uid) return { error: "Sign in again to submit." };
  const player = await getCoursePlayer(courseId);
  const mod = player?.modules.find((m) => m.quiz?.id === quizId);
  if (!player || !mod?.quiz) return { error: "This quiz isn't available." };
  if (mod.locked) return { error: "Pass the earlier module's quiz first." };

  const db = createAdminClient();
  const { data: questions } = await db.from("quiz_questions").select("correct_index, explanation, options").eq("quiz_id", quizId).order("position");
  if (!questions?.length) return { error: "This quiz has no questions yet." };
  if (answers.length !== questions.length || answers.some((a, i) => !Number.isInteger(a) || a < 0 || a >= questions[i].options.length))
    return { error: "Answer every question before submitting." };

  const right = questions.filter((q, i) => answers[i] === q.correct_index).length;
  const score = Math.round((right / questions.length) * 100);
  const passed = score >= mod.quiz.passMark;
  await db.from("quiz_attempts").insert({ quiz_id: quizId, user_id: uid, score, passed, answers });
  if (passed) await Promise.all([syncBadges(uid), syncCertificates(uid)]);
  refresh();
  return {
    score,
    passed,
    passMark: mod.quiz.passMark,
    results: questions.map((q, i) => ({ chosen: answers[i], correct: q.correct_index, explanation: q.explanation })),
  };
}

// One review per learner per course. Editing it sends it back for approval.
export async function submitReview(courseId: string, rating: number, body: string): Promise<{ ok?: string; error?: string }> {
  const uid = await userId();
  if (!uid) return { error: "Sign in again to leave a review." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Pick a star rating." };
  const player = await getCoursePlayer(courseId);
  if (!player?.review.canReview) return { error: "You can review this course once you're 30% through it." };
  const text = body.trim().slice(0, 2000);
  const check = await moderate("course_review", uid, [text]);
  if (check.error) return { error: check.error };
  const { data, error } = await createAdminClient()
    .from("course_reviews")
    .upsert({ course_id: courseId, user_id: uid, rating, body: text || null, approved: false }, { onConflict: "course_id,user_id" })
    .select("id")
    .single();
  if (error) return { error: "Couldn't save your review. Try again." };
  await check.record(data?.id);
  refresh();
  return { ok: "Thanks! Your review shows on the course once the team has checked it." };
}

// YouTube lessons usually have no length typed in. The player reports it the first time someone watches, so
// "time left" and course totals can use real hours. Only fills a missing length, never overwrites one.
export async function reportLessonDuration(courseId: string, lessonId: string, seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 5 || seconds > 12 * 3600) return;
  const player = await getCoursePlayer(courseId);
  const lesson = player?.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  if (!lesson || lesson.durationSeconds || !/youtu\.?be/i.test(lesson.videoUrl ?? "")) return;
  await createAdminClient().from("lessons").update({ duration_seconds: Math.round(seconds) }).eq("id", lessonId).is("duration_seconds", null);
}

export type WatchState = { watched: number; duration: number | null; qualified: boolean };

// Share of a video lesson that must be played before it can be marked complete.
const WATCH_NEEDED = 0.9;

// Adds newly played seconds of a lesson video. Each report is capped by the real time since the last one (allowing
// 2x speed), so skipping ahead or calling this directly can't fill it faster than the video plays.
export async function reportLessonWatch(courseId: string, lessonId: string, seconds: number, videoDuration: number): Promise<WatchState | null> {
  const uid = await userId();
  if (!uid || !Number.isFinite(seconds) || seconds <= 0) return null;
  const player = await getCoursePlayer(courseId);
  const lesson = player?.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  if (!lesson?.videoUrl) return null;
  const duration = lesson.durationSeconds || (Number.isFinite(videoDuration) && videoDuration >= 5 ? Math.round(videoDuration) : null);

  const db = createAdminClient();
  const { data: row, error } = await db.from("lesson_watch").select("watched_seconds, updated_at").eq("user_id", uid).eq("lesson_id", lessonId).maybeSingle();
  if (error) return null;
  const elapsed = row ? (Date.now() - new Date(row.updated_at).getTime()) / 1000 : 30;
  const added = Math.min(seconds, elapsed * 2.1 + 5);
  const watched = Math.round(Math.min((row?.watched_seconds ?? 0) + added, duration ?? Infinity));
  const qualified = !!duration && watched >= duration * WATCH_NEEDED;
  await db.from("lesson_watch").upsert({ user_id: uid, lesson_id: lessonId, watched_seconds: watched, qualified, updated_at: new Date().toISOString() });
  return { watched, duration, qualified };
}
