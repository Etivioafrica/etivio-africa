"use server";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCoursePlayer } from "@/lib/data/learn";
import { syncBadges } from "@/lib/data/badges";
import { syncCertificates } from "@/lib/data/certificates";

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
  const { error } = await createAdminClient()
    .from("course_reviews")
    .upsert({ course_id: courseId, user_id: uid, rating, body: text || null, approved: false }, { onConflict: "course_id,user_id" });
  if (error) return { error: "Couldn't save your review. Try again." };
  refresh();
  return { ok: "Thanks! Your review shows on the course once the team has checked it." };
}
