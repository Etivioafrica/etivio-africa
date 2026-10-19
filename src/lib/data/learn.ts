import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionUser } from "@/lib/supabase/session";
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
  category: string | null;
  skills: string[];
  featured?: boolean;
  rating?: number | null;
  reviews?: number;
};

export type MyCourse = CourseCard & {
  enrolledAt: string;
  done: number;
  progress: number;
  completed: boolean;
  lastActivity: string;
  // Remaining lesson time when lessons have durations; otherwise just the count left.
  secondsLeft: number;
  lessonsLeft: number;
};

const COURSE_COLS =
  "id, title, slug, summary, cover_url, level, price_minor, currency, category, skills, featured, instructor:profiles!courses_instructor_id_fkey(full_name)";

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  cover_url: string | null;
  level: string;
  price_minor: number;
  currency: string;
  category: string | null;
  skills: string[] | null;
  featured: boolean;
  instructor: { full_name: string | null } | null;
};

async function lessonCounts(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const supabase = await createClient();
  const { data } = await supabase.rpc("course_lesson_counts", { p_course_ids: ids });
  return new Map((data ?? []).map((r) => [r.course_id, r.lesson_count]));
}

// Quizzes per course and how many of them this learner has passed.
export async function quizProgress(userId: string, ids: string[]) {
  if (!ids.length) return new Map<string, { quizzes: number; passed: number }>();
  const supabase = await createClient();
  const { data } = await supabase.rpc("quiz_progress", { p_user_id: userId, p_course_ids: ids });
  return new Map((data ?? []).map((q) => [q.course_id, { quizzes: q.quizzes, passed: q.passed }]));
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
    category: c.category,
    skills: c.skills ?? [],
    featured: c.featured,
  };
}

// Courses the current user is enrolled in, with progress.
export async function getMyCourses(): Promise<MyCourse[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: enrollments }, { data: progress }] = await Promise.all([
    supabase.from("enrollments").select(`enrolled_at, course:courses(${COURSE_COLS})`).eq("user_id", user.id).order("enrolled_at", { ascending: false }),
    supabase.from("lesson_progress").select("lesson_id, completed_at, lesson:lessons(course_id)").eq("user_id", user.id),
  ]);

  const rows = (enrollments ?? []).filter((e) => e.course) as unknown as { enrolled_at: string; course: CourseRow }[];
  const doneIds = new Set((progress ?? []).map((p) => p.lesson_id));
  const { data: lessonRows } = rows.length
    ? await supabase.from("lessons").select("id, course_id, duration_seconds").in("course_id", rows.map((r) => r.course.id))
    : { data: [] };
  const leftBy = new Map<string, { seconds: number; lessons: number }>();
  for (const l of lessonRows ?? []) {
    if (doneIds.has(l.id)) continue;
    const cur = leftBy.get(l.course_id) ?? { seconds: 0, lessons: 0 };
    cur.seconds += l.duration_seconds ?? 0;
    cur.lessons += 1;
    leftBy.set(l.course_id, cur);
  }
  const counts = await lessonCounts(rows.map((r) => r.course.id));
  const quizBy = await quizProgress(
    user.id,
    rows.map((r) => r.course.id),
  );

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
      const quiz = quizBy.get(card.id) ?? { quizzes: 0, passed: 0 };
      return {
        ...card,
        enrolledAt: r.enrolled_at,
        done,
        progress: percent(done + quiz.passed, card.lessonCount + quiz.quizzes),
        completed: card.lessonCount > 0 && done >= card.lessonCount && quiz.passed >= quiz.quizzes,
        lastActivity: d?.last || r.enrolled_at,
        secondsLeft: leftBy.get(card.id)?.seconds ?? 0,
        lessonsLeft: leftBy.get(card.id)?.lessons ?? Math.max(0, card.lessonCount - done),
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
  const ids = rows.map((r) => r.id);
  const [counts, { data: ratings }] = await Promise.all([lessonCounts(ids), ids.length ? supabase.rpc("course_ratings", { p_course_ids: ids }) : Promise.resolve({ data: [] })]);
  const rated = new Map((ratings ?? []).map((r) => [r.course_id, r]));
  return rows.map((r) => ({ ...toCard(r, counts), rating: rated.has(r.id) ? Number(rated.get(r.id)!.rating) : null, reviews: rated.get(r.id)?.reviews ?? 0 }));
}

export type PlayerLesson = {
  id: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  isPreview: boolean;
  kind: "video" | "reading";
  done: boolean;
};

export type PlayerQuiz = { id: string; title: string; passMark: number; questions: number; passed: boolean; best: number | null };
// `locked`: an earlier module's quiz hasn't been passed yet.
export type PlayerModule = { id: string; title: string; lessons: PlayerLesson[]; quiz: PlayerQuiz | null; locked: boolean };

// Everything the course player needs. Returns null when the user can't access the course.
export async function getCoursePlayer(courseId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: course } = await supabase.from("courses").select(`${COURSE_COLS}, instructor_id`).eq("id", courseId).maybeSingle();
  if (!course) return null;

  const { data: enrollment } = await supabase.from("enrollments").select("enrolled_at").eq("user_id", user.id).eq("course_id", courseId).maybeSingle();
  const isOwner = course.instructor_id === user.id;
  if (!enrollment && !isOwner) return null;

  const [{ data: modules }, { data: lessons }, { data: progress }, { data: quizzes }, { data: attempts }, { data: review }] = await Promise.all([
    supabase.from("course_modules").select("id, title, position").eq("course_id", courseId).order("position"),
    supabase
      .from("lessons")
      .select("id, module_id, title, content, video_url, duration_seconds, is_preview, kind, position")
      .eq("course_id", courseId)
      .order("position"),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id),
    createAdminClient().from("course_quizzes").select("id, title, module_id, pass_mark, questions:quiz_questions(count)").eq("course_id", courseId),
    supabase.from("quiz_attempts").select("quiz_id, passed, score").eq("user_id", user.id),
    supabase.from("course_reviews").select("rating, body, approved, admin_reply").eq("course_id", courseId).eq("user_id", user.id).maybeSingle(),
  ]);
  const quizFor = (moduleId: string): PlayerQuiz | null => {
    const q = (quizzes ?? []).find((x) => x.module_id === moduleId);
    if (!q) return null;
    const mine = (attempts ?? []).filter((a) => a.quiz_id === q.id);
    return {
      id: q.id,
      title: q.title,
      passMark: q.pass_mark,
      questions: (q.questions as unknown as { count: number }[])?.[0]?.count ?? 0,
      passed: mine.some((a) => a.passed),
      best: mine.length ? Math.max(...mine.map((a) => a.score)) : null,
    };
  };

  const done = new Set((progress ?? []).map((p) => p.lesson_id));
  let blocked = false;
  const tree: PlayerModule[] = (modules ?? []).map((m) => {
    const quiz = quizFor(m.id);
    const locked = blocked && !isOwner;
    // A quiz with no questions yet never blocks anyone.
    if (quiz && quiz.questions > 0 && !quiz.passed) blocked = true;
    return {
      id: m.id,
      title: m.title,
      quiz: quiz && quiz.questions > 0 ? quiz : null,
      locked,
      lessons: (lessons ?? [])
        .filter((l) => l.module_id === m.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          content: l.content,
          videoUrl: l.video_url,
          durationSeconds: l.duration_seconds,
          isPreview: l.is_preview,
          kind: l.kind === "reading" ? ("reading" as const) : ("video" as const),
          done: done.has(l.id),
        })),
    };
  });

  const flat = tree.flatMap((m) => m.lessons);
  const doneCount = flat.filter((l) => l.done).length;
  const quizList = tree.flatMap((m) => (m.quiz ? [m.quiz] : []));
  const passedCount = quizList.filter((q) => q.passed).length;
  const progressPct = percent(doneCount + passedCount, flat.length + quizList.length);

  return {
    course: toCard(course as unknown as CourseRow, new Map([[courseId, flat.length]])),
    modules: tree,
    lessons: flat,
    doneCount,
    quizzes: quizList,
    passedCount,
    progress: progressPct,
    isOwner,
    // Reviews open at 30% progress.
    review: { canReview: !isOwner && progressPct >= 30, mine: review ?? null },
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

// Course details page for the catalog: the outline (titles only), what's included, reviews and the instructor.
// Uses the service role because lesson rows are only readable once enrolled; nothing here exposes lesson content.
// Looks a course up by id (inside the app) or slug (public /courses page). Works for visitors who aren't signed in.
export async function getCourseDetails(idOrSlug: string) {
  const byId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(idOrSlug);
  if (!byId && !/^[a-z0-9-]{1,120}$/.test(idOrSlug)) return null;
  const user = await sessionUser(await createClient());
  const db = createAdminClient();
  const { data: course } = await db
    .from("courses")
    .select(
      "id, slug, title, summary, description, cover_url, level, price_minor, currency, category, skills, status, featured, published_at, instructor_id, updated_at, instructor:profiles!courses_instructor_id_fkey(full_name, avatar_url, headline, bio)",
    )
    .eq(byId ? "id" : "slug", idOrSlug)
    .maybeSingle();
  if (!course || course.status !== "published") return null;
  const courseId = course.id;
  const none = Promise.resolve({ data: null });

  const [{ data: modules }, { data: lessons }, { data: quizzes }, { count: files }, { data: enrollment }, { data: saved }, { count: students }, { data: reviews }] = await Promise.all([
    db.from("course_modules").select("id, title").eq("course_id", courseId).order("position"),
    db.from("lessons").select("id, module_id, title, kind, duration_seconds, is_preview").eq("course_id", courseId).order("position"),
    db.from("course_quizzes").select("module_id, title").eq("course_id", courseId),
    db.from("documents").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    user ? db.from("enrollments").select("enrolled_at").eq("course_id", courseId).eq("user_id", user.id).maybeSingle() : none,
    user ? db.from("saved_courses").select("course_id").eq("course_id", courseId).eq("user_id", user.id).maybeSingle() : none,
    db.from("enrollments").select("user_id", { count: "exact", head: true }).eq("course_id", courseId),
    db
      .from("course_reviews")
      .select("id, rating, body, admin_reply, created_at, author:profiles!course_reviews_user_id_fkey(full_name, avatar_url)")
      .eq("course_id", courseId)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const all = lessons ?? [];
  const rated = reviews ?? [];
  return {
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      description: course.description,
      coverUrl: course.cover_url,
      level: course.level,
      priceMinor: course.price_minor,
      currency: course.currency,
      category: course.category,
      skills: course.skills ?? [],
      updatedAt: course.updated_at,
      publishedAt: course.published_at,
      featured: course.featured,
    },
    instructor: {
      name: course.instructor?.full_name || "Etivio instructor",
      avatar: course.instructor?.avatar_url ?? null,
      headline: course.instructor?.headline ?? null,
      bio: course.instructor?.bio ?? null,
    },
    modules: (modules ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      lessons: all
        .filter((l) => l.module_id === m.id)
        .map((l) => ({ id: l.id, title: l.title, kind: l.kind === "reading" ? ("reading" as const) : ("video" as const), seconds: l.duration_seconds, preview: l.is_preview })),
      quiz: (quizzes ?? []).find((q) => q.module_id === m.id)?.title ?? null,
    })),
    stats: {
      lessons: all.length,
      videos: all.filter((l) => l.kind !== "reading").length,
      readings: all.filter((l) => l.kind === "reading").length,
      seconds: all.reduce((n, l) => n + (l.duration_seconds ?? 0), 0),
      quizzes: (quizzes ?? []).length,
      files: files ?? 0,
      students: students ?? 0,
      rating: rated.length ? Math.round((rated.reduce((n, r) => n + r.rating, 0) / rated.length) * 10) / 10 : null,
      reviews: rated.length,
    },
    reviews: rated.slice(0, 6).map((r) => ({ id: r.id, rating: r.rating, body: r.body, reply: r.admin_reply, at: r.created_at, author: r.author?.full_name || "Learner", avatar: r.author?.avatar_url ?? null })),
    enrolled: !!enrollment || (!!user && course.instructor_id === user.id),
    saved: !!saved,
    signedIn: !!user,
  };
}
