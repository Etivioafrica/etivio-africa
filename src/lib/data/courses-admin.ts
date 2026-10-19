import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category } from "@/components/dash/CategoryManager";

export type CourseMetric = { students: number; completed: number; revenue: number; rating: number | null; reviews: number; pendingReviews: number };

export async function courseMetrics() {
  const { data } = await createAdminClient().rpc("course_metrics");
  const by: Record<string, CourseMetric> = {};
  for (const m of data ?? [])
    by[m.course_id] = {
      students: m.students,
      completed: m.completed,
      revenue: Number(m.revenue_minor),
      rating: m.rating === null ? null : Number(m.rating),
      reviews: m.reviews,
      pendingReviews: m.pending_reviews,
    };
  return by;
}

export async function getCourseCategories() {
  const { data } = await createAdminClient().from("course_categories").select("id, name, slug, parent_id").order("name");
  return (data ?? []) as Category[];
}

// Everything the admin course list needs.
export async function getAdminCourses() {
  const db = createAdminClient();
  const [courses, lessons, quizzes, categories, metrics] = await Promise.all([
    db
      .from("courses")
      .select("id, title, slug, cover_url, status, featured, level, price_minor, currency, category_id, updated_at, published_at, instructor:profiles!courses_instructor_id_fkey(full_name)")
      .order("updated_at", { ascending: false }),
    db.from("lessons").select("course_id"),
    db.from("course_quizzes").select("course_id"),
    getCourseCategories(),
    courseMetrics(),
  ]);
  const tally = (rows: { course_id: string }[] | null) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) m[r.course_id] = (m[r.course_id] ?? 0) + 1;
    return m;
  };
  const lessonsBy = tally(lessons.data);
  const quizzesBy = tally(quizzes.data);
  return {
    courses: (courses.data ?? []).map((c) => ({
      ...c,
      instructor: c.instructor?.full_name ?? null,
      lessons: lessonsBy[c.id] ?? 0,
      quizzes: quizzesBy[c.id] ?? 0,
    })),
    categories,
    metrics,
  };
}

export type AdminCourse = Awaited<ReturnType<typeof getAdminCourses>>["courses"][number];

// Per-student progress for one course or all of them (lessons done + quizzes passed).
export async function getStudentProgress(courseId?: string) {
  const db = createAdminClient();
  let enrolQ = db
    .from("enrollments")
    .select("user_id, course_id, enrolled_at, student:profiles!enrollments_user_id_fkey(full_name, avatar_url), course:courses(title)")
    .order("enrolled_at", { ascending: false })
    .limit(2000);
  if (courseId) enrolQ = enrolQ.eq("course_id", courseId);
  const enrol = (await enrolQ).data ?? [];
  if (!enrol.length) return [];
  const courseIds = [...new Set(enrol.map((e) => e.course_id))];
  const userIds = [...new Set(enrol.map((e) => e.user_id))];

  const [lessons, progress, quizzes, attempts, certs] = await Promise.all([
    db.from("lessons").select("id, course_id").in("course_id", courseIds),
    db.from("lesson_progress").select("user_id, lesson_id, completed_at").in("user_id", userIds),
    db.from("course_quizzes").select("id, course_id").in("course_id", courseIds),
    db.from("quiz_attempts").select("user_id, quiz_id, passed, created_at").in("user_id", userIds),
    db.from("certificates").select("user_id, course_id, code, revoked_at").in("course_id", courseIds),
  ]);

  const lessonCourse = new Map((lessons.data ?? []).map((l) => [l.id, l.course_id]));
  const quizCourse = new Map((quizzes.data ?? []).map((q) => [q.id, q.course_id]));
  const total = (map: Map<string, string>, course: string) => [...map.values()].filter((c) => c === course).length;
  const key = (u: string, c: string) => `${u}:${c}`;
  const done = new Map<string, number>();
  const last = new Map<string, string>();
  for (const p of progress.data ?? []) {
    const c = lessonCourse.get(p.lesson_id);
    if (!c) continue;
    const k = key(p.user_id, c);
    done.set(k, (done.get(k) ?? 0) + 1);
    if (p.completed_at > (last.get(k) ?? "")) last.set(k, p.completed_at);
  }
  const passed = new Map<string, Set<string>>();
  for (const a of attempts.data ?? []) {
    const c = quizCourse.get(a.quiz_id);
    if (!c) continue;
    const k = key(a.user_id, c);
    if (a.created_at > (last.get(k) ?? "")) last.set(k, a.created_at);
    if (a.passed) passed.set(k, (passed.get(k) ?? new Set()).add(a.quiz_id));
  }
  const certBy = new Map((certs.data ?? []).map((c) => [key(c.user_id, c.course_id ?? ""), c]));

  return enrol.map((e) => {
    const k = key(e.user_id, e.course_id);
    const steps = total(lessonCourse, e.course_id) + total(quizCourse, e.course_id);
    const finished = (done.get(k) ?? 0) + (passed.get(k)?.size ?? 0);
    const cert = certBy.get(k);
    return {
      userId: e.user_id,
      courseId: e.course_id,
      name: e.student?.full_name || "Unnamed",
      avatar: e.student?.avatar_url ?? null,
      course: e.course?.title ?? "Deleted course",
      enrolledAt: e.enrolled_at,
      lastActive: last.get(k) ?? null,
      progress: steps ? Math.round((finished / steps) * 100) : 0,
      completed: steps > 0 && finished >= steps,
      certificate: cert && !cert.revoked_at ? cert.code : null,
    };
  });
}

export type StudentRow = Awaited<ReturnType<typeof getStudentProgress>>[number];

// Reviews for the admin, newest first. Callers check admin access.
export async function loadReviews(courseId?: string) {
  const db = createAdminClient();
  let q = db
    .from("course_reviews")
    .select("id, rating, body, approved, admin_reply, replied_at, created_at, user_id, course_id, author:profiles!course_reviews_user_id_fkey(full_name, avatar_url), course:courses(title)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (courseId) q = q.eq("course_id", courseId);
  const { data } = await q;
  return (data ?? []).map((r) => ({ ...r, author: r.author?.full_name || "Learner", avatar: r.author?.avatar_url ?? null, course: r.course?.title ?? "Deleted course" }));
}

