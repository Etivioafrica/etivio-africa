import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { percent } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type CourseRow = Database["public"]["Tables"]["courses"]["Row"];

export type TeachCourse = CourseRow & { lessonCount: number; studentCount: number };

// All of the current instructor's courses with lesson and student counts.
export async function getMyTeachingCourses(): Promise<TeachCourse[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("instructor_id", user.id)
    .order("updated_at", { ascending: false });

  const list = courses ?? [];
  if (!list.length) return [];
  const ids = list.map((c) => c.id);

  const [{ data: counts }, { data: enrollments }] = await Promise.all([
    supabase.rpc("course_lesson_counts", { p_course_ids: ids }),
    supabase.from("enrollments").select("course_id").in("course_id", ids),
  ]);

  const lessonsBy = new Map((counts ?? []).map((r) => [r.course_id, r.lesson_count]));
  const studentsBy = new Map<string, number>();
  for (const e of enrollments ?? []) studentsBy.set(e.course_id, (studentsBy.get(e.course_id) ?? 0) + 1);

  return list.map((c) => ({ ...c, lessonCount: lessonsBy.get(c.id) ?? 0, studentCount: studentsBy.get(c.id) ?? 0 }));
}

export type StudentRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  courseId: string;
  courseTitle: string;
  enrolledAt: string;
  done: number;
  total: number;
  progress: number;
};

// Enrollments across the instructor's courses, newest first, with each student's progress.
export async function getMyStudents(limit = 200): Promise<StudentRow[]> {
  const courses = await getMyTeachingCourses();
  if (!courses.length) return [];
  const supabase = await createClient();
  const ids = courses.map((c) => c.id);
  const byId = new Map(courses.map((c) => [c.id, c]));

  const [{ data: enrollments }, { data: progress }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("user_id, course_id, enrolled_at, student:profiles!enrollments_user_id_fkey(full_name, avatar_url)")
      .in("course_id", ids)
      .order("enrolled_at", { ascending: false })
      .limit(limit),
    supabase.from("lesson_progress").select("user_id, lesson:lessons!inner(course_id)").in("lesson.course_id", ids),
  ]);

  const doneBy = new Map<string, number>();
  for (const p of progress ?? []) {
    const courseId = (p.lesson as { course_id: string } | null)?.course_id;
    if (!courseId) continue;
    const key = `${p.user_id}:${courseId}`;
    doneBy.set(key, (doneBy.get(key) ?? 0) + 1);
  }

  return (enrollments ?? []).map((e) => {
    const course = byId.get(e.course_id)!;
    const student = e.student as { full_name: string | null; avatar_url: string | null } | null;
    const done = doneBy.get(`${e.user_id}:${e.course_id}`) ?? 0;
    return {
      userId: e.user_id,
      name: student?.full_name || "Unnamed student",
      avatarUrl: student?.avatar_url ?? null,
      courseId: e.course_id,
      courseTitle: course.title,
      enrolledAt: e.enrolled_at,
      done,
      total: course.lessonCount,
      progress: percent(done, course.lessonCount),
    };
  });
}

export type EditorLesson = Database["public"]["Tables"]["lessons"]["Row"];
export type EditorModule = { id: string; title: string; position: number; lessons: EditorLesson[] };

// A single course with its full curriculum, only if the current user owns it.
export async function getCourseForEditing(courseId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .eq("instructor_id", user.id)
    .maybeSingle();
  if (!course) return null;

  const [{ data: modules }, { data: lessons }, { count: students }] = await Promise.all([
    supabase.from("course_modules").select("id, title, position").eq("course_id", courseId).order("position"),
    supabase.from("lessons").select("*").eq("course_id", courseId).order("position"),
    supabase.from("enrollments").select("user_id", { count: "exact", head: true }).eq("course_id", courseId),
  ]);

  const tree: EditorModule[] = (modules ?? []).map((m) => ({
    ...m,
    lessons: (lessons ?? []).filter((l) => l.module_id === m.id),
  }));

  return { course, modules: tree, lessonCount: lessons?.length ?? 0, studentCount: students ?? 0 };
}

export async function getLessonForEditing(courseId: string, lessonId: string) {
  const data = await getCourseForEditing(courseId);
  if (!data) return null;
  const lesson = data.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  return lesson ? { course: data.course, modules: data.modules, lesson } : null;
}
