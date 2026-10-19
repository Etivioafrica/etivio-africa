import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { courseMetrics, getStudentProgress } from "@/lib/data/courses-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { CourseMetricsView } from "./CourseMetricsView";

export const metadata = { title: "Course metrics" };

type Props = { searchParams: Promise<{ course?: string }> };

export default function CourseMetricsPage({ searchParams }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: Props) {
  await requireAdmin("courses");
  const { course } = await searchParams;
  const db = createAdminClient();
  const since = dayKey(29);
  const [{ data: courses }, metrics, students, { data: enrolDays }] = await Promise.all([
    db.from("courses").select("id, title, cover_url, status, price_minor").order("title"),
    courseMetrics(),
    getStudentProgress(),
    db.from("enrollments").select("enrolled_at, course_id").gte("enrolled_at", since),
  ]);
  const list = courses ?? [];
  const selected = list.find((c) => c.id === course)?.id ?? list.find((c) => c.status === "published")?.id ?? list[0]?.id ?? null;

  // Drop-off for the chosen course: how many learners finished each lesson and quiz, in course order.
  let funnel: { label: string; kind: "lesson" | "quiz"; done: number }[] = [];
  if (selected) {
    const [{ data: mods }, { data: lessons }, { data: quizzes }] = await Promise.all([
      db.from("course_modules").select("id, title, position").eq("course_id", selected).order("position"),
      db.from("lessons").select("id, title, module_id, position").eq("course_id", selected).order("position"),
      db.from("course_quizzes").select("id, title, module_id").eq("course_id", selected),
    ]);
    const lessonIds = (lessons ?? []).map((l) => l.id);
    const quizIds = (quizzes ?? []).map((q) => q.id);
    const [{ data: lp }, { data: qa }] = await Promise.all([
      lessonIds.length ? db.from("lesson_progress").select("lesson_id").in("lesson_id", lessonIds) : Promise.resolve({ data: [] as { lesson_id: string }[] }),
      quizIds.length ? db.from("quiz_attempts").select("quiz_id, user_id").eq("passed", true).in("quiz_id", quizIds) : Promise.resolve({ data: [] as { quiz_id: string; user_id: string }[] }),
    ]);
    const lessonDone = new Map<string, number>();
    for (const p of lp ?? []) lessonDone.set(p.lesson_id, (lessonDone.get(p.lesson_id) ?? 0) + 1);
    const quizDone = new Map<string, Set<string>>();
    for (const a of qa ?? []) quizDone.set(a.quiz_id, (quizDone.get(a.quiz_id) ?? new Set()).add(a.user_id));
    for (const m of mods ?? []) {
      for (const l of (lessons ?? []).filter((x) => x.module_id === m.id)) funnel.push({ label: l.title, kind: "lesson", done: lessonDone.get(l.id) ?? 0 });
      const q = (quizzes ?? []).find((x) => x.module_id === m.id);
      if (q) funnel.push({ label: q.title, kind: "quiz", done: quizDone.get(q.id)?.size ?? 0 });
    }
    funnel = funnel.slice(0, 80);
  }

  const days: { label: string; value: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = dayKey(i);
    days.push({ label: new Date(key).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), value: (enrolDays ?? []).filter((e) => e.enrolled_at.slice(0, 10) === key && (!course || e.course_id === course)).length });
  }

  return (
    <CourseMetricsView
      courses={list.map((c) => ({ ...c, ...(metrics[c.id] ?? { students: 0, completed: 0, revenue: 0, rating: null, reviews: 0, pendingReviews: 0 }), avgProgress: avg(students.filter((s) => s.courseId === c.id).map((s) => s.progress)) }))}
      selected={selected}
      funnel={funnel}
      enrolled={selected ? students.filter((s) => s.courseId === selected).length : 0}
      days={days}
      filtered={!!course}
    />
  );
}

// YYYY-MM-DD for `ago` days back.
const dayKey = (ago: number) => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
