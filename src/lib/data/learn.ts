import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { percent } from "@/lib/format";

export type CourseCard = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverUrl: string | null;
  level: string;
  priceMinor: number;
  currency: string;
  instructor: string;
  lessonCount: number;
};

export type MyCourse = CourseCard & {
  enrolledAt: string;
  done: number;
  progress: number;
  completed: boolean;
  lastActivity: string;
};

const COURSE_COLS =
  "id, title, slug, summary, cover_url, level, price_minor, currency, instructor:profiles!courses_instructor_id_fkey(full_name)";

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  cover_url: string | null;
  level: string;
  price_minor: number;
  currency: string;
  instructor: { full_name: string | null } | null;
};

async function lessonCounts(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const supabase = await createClient();
  const { data } = await supabase.rpc("course_lesson_counts", { p_course_ids: ids });
  return new Map((data ?? []).map((r) => [r.course_id, r.lesson_count]));
}

function toCard(c: CourseRow, counts: Map<string, number>): CourseCard {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    summary: c.summary,
    coverUrl: c.cover_url,
    level: c.level,
    priceMinor: c.price_minor,
    currency: c.currency,
    instructor: c.instructor?.full_name || "Etivio instructor",
    lessonCount: counts.get(c.id) ?? 0,
  };
}

// Courses the current user is enrolled in, with progress.
export async function getMyCourses(): Promise<MyCourse[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: enrollments }, { data: progress }] = await Promise.all([
    supabase
      .from("enrollments")
      .select(`enrolled_at, course:courses(${COURSE_COLS})`)
      .eq("user_id", user.id)
      .order("enrolled_at", { ascending: false }),
    supabase.from("lesson_progress").select("completed_at, lesson:lessons(course_id)").eq("user_id", user.id),
  ]);

  const rows = (enrollments ?? []).filter((e) => e.course) as unknown as { enrolled_at: string; course: CourseRow }[];
  const counts = await lessonCounts(rows.map((r) => r.course.id));

  const doneBy = new Map<string, { done: number; last: string }>();
  for (const p of progress ?? []) {
    const courseId = (p.lesson as { course_id: string } | null)?.course_id;
    if (!courseId) continue;
    const cur = doneBy.get(courseId) ?? { done: 0, last: "" };
    cur.done += 1;
    if (p.completed_at > cur.last) cur.last = p.completed_at;
    doneBy.set(courseId, cur);
  }

  return rows
    .map((r) => {
      const card = toCard(r.course, counts);
      const d = doneBy.get(card.id);
      const done = d?.done ?? 0;
      return {
        ...card,
        enrolledAt: r.enrolled_at,
        done,
        progress: percent(done, card.lessonCount),
        completed: card.lessonCount > 0 && done >= card.lessonCount,
        lastActivity: d?.last || r.enrolled_at,
      };
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

// Published catalog, newest first.
export async function getCatalog(limit = 60): Promise<CourseCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select(COURSE_COLS)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  const rows = (data ?? []) as unknown as CourseRow[];
  const counts = await lessonCounts(rows.map((r) => r.id));
  return rows.map((r) => toCard(r, counts));
}

export type PlayerLesson = {
  id: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  isPreview: boolean;
  done: boolean;
};

export type PlayerModule = { id: string; title: string; lessons: PlayerLesson[] };

// Everything the course player needs. Returns null when the user can't access the course.
export async function getCoursePlayer(courseId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select(`${COURSE_COLS}, instructor_id`)
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return null;

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("enrolled_at")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();
  const isOwner = course.instructor_id === user.id;
  if (!enrollment && !isOwner) return null;

  const [{ data: modules }, { data: lessons }, { data: progress }] = await Promise.all([
    supabase.from("course_modules").select("id, title, position").eq("course_id", courseId).order("position"),
    supabase
      .from("lessons")
      .select("id, module_id, title, content, video_url, duration_seconds, is_preview, position")
      .eq("course_id", courseId)
      .order("position"),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id),
  ]);

  const done = new Set((progress ?? []).map((p) => p.lesson_id));
  const tree: PlayerModule[] = (modules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    lessons: (lessons ?? [])
      .filter((l) => l.module_id === m.id)
      .map((l) => ({
        id: l.id,
        title: l.title,
        content: l.content,
        videoUrl: l.video_url,
        durationSeconds: l.duration_seconds,
        isPreview: l.is_preview,
        done: done.has(l.id),
      })),
  }));

  const flat = tree.flatMap((m) => m.lessons);
  const doneCount = flat.filter((l) => l.done).length;

  return {
    course: toCard(course as unknown as CourseRow, new Map([[courseId, flat.length]])),
    modules: tree,
    lessons: flat,
    doneCount,
    progress: percent(doneCount, flat.length),
  };
}

export async function getSavedIds(): Promise<Set<string>> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("saved_courses").select("course_id").eq("user_id", user.id);
  return new Set((data ?? []).map((r) => r.course_id));
}

// Saved courses that are still published, newest save first.
export async function getSavedCourses(): Promise<CourseCard[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_courses")
    .select(`created_at, course:courses(${COURSE_COLS}, status)`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []).map((r) => r.course).filter((c) => c && (c as { status: string }).status === "published") as unknown as CourseRow[];
  const counts = await lessonCounts(rows.map((r) => r.id));
  return rows.map((r) => toCard(r, counts));
}
