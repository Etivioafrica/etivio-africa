import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { getMyPrivateProfile } from "@/lib/my-profile";
import { percent } from "@/lib/format";
import { buildHeatmap, dailyCounts, type Heatmap } from "@/lib/activity";
import type { BadgeId } from "@/lib/badges";

export type NotificationPrefs = { course_updates: boolean; support_replies: boolean; product_news: boolean };

export const DEFAULT_PREFS: NotificationPrefs = { course_updates: true, support_replies: true, product_news: false };

export function readPrefs(raw: unknown): NotificationPrefs {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    course_updates: typeof o.course_updates === "boolean" ? o.course_updates : DEFAULT_PREFS.course_updates,
    support_replies: typeof o.support_replies === "boolean" ? o.support_replies : DEFAULT_PREFS.support_replies,
    product_news: typeof o.product_news === "boolean" ? o.product_news : DEFAULT_PREFS.product_news,
  };
}

export type ProfileDetails = {
  id: string;
  username: string | null;
  profilePublic: boolean;
  name: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  headline: string | null;
  location: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  xUrl: string | null;
  interests: string[];
  notificationPrefs: NotificationPrefs;
  joinedAt: string;
  // Lessons per week the learner is aiming for (null = no goal set).
  weeklyGoal: number | null;
  showCurrentLearning: boolean;
};

export type ProfileCourse = {
  id: string;
  skills: string[];
  title: string;
  coverUrl: string | null;
  level: string;
  instructor: string;
  enrolledAt: string;
  done: number;
  total: number;
  progress: number;
  completed: boolean;
  lastActivity: string;
};

export type ProfileActivity = { lessonId: string; lessonTitle: string; courseId: string; courseTitle: string; at: string };

export type LearnerProfile = {
  profile: ProfileDetails;
  courses: ProfileCourse[];
  recent: ProfileActivity[];
  heatmap: Heatmap;
  // Recorded badges, newest first (only readable for your own profile).
  badges: { id: BadgeId; earnedAt: string }[];
  stats: { enrolled: number; completed: number; lessonsDone: number; secondsLearned: number; activeDays: number };
  // Skills from completed courses, most common first.
  skills: string[];
};

// Public fields for anyone the viewer can see (RLS hides deleted accounts). Private fields (preferences, goal)
// only come back for the viewer's own profile; for someone else they're defaults.
export async function getProfileDetails(userId: string): Promise<ProfileDetails | null> {
  const supabase = await createClient();
  const [{ data: p }, user] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, profile_public, full_name, avatar_url, cover_url, bio, headline, location, website_url, linkedin_url, x_url, interests, created_at")
      .eq("id", userId)
      .maybeSingle(),
    sessionUser(supabase),
  ]);
  if (!p) return null;
  const priv = user?.id === userId ? await getMyPrivateProfile() : null;
  return {
    id: p.id,
    username: p.username,
    profilePublic: p.profile_public,
    name: p.full_name || "Etivio learner",
    avatarUrl: p.avatar_url,
    coverUrl: p.cover_url,
    bio: p.bio,
    headline: p.headline,
    location: p.location,
    websiteUrl: p.website_url,
    linkedinUrl: p.linkedin_url,
    xUrl: p.x_url,
    interests: p.interests ?? [],
    notificationPrefs: readPrefs(priv?.notification_prefs),
    joinedAt: p.created_at,
    weeklyGoal: priv?.weekly_goal ?? null,
    showCurrentLearning: priv?.show_current_learning ?? true,
  };
}

type EnrollmentRow = {
  enrolled_at: string;
  course: {
    id: string;
    title: string;
    cover_url: string | null;
    level: string;
    skills: string[];
    instructor: { full_name: string | null } | null;
  } | null;
};

type ProgressRow = {
  completed_at: string;
  lesson: { id: string; title: string; course_id: string; duration_seconds: number | null } | null;
};

// A learner's profile with their courses and progress. Runs as the viewer, so RLS decides what is visible:
// the learner sees everything, a tutor only sees enrollments + progress in courses they own.
// Cached per request: the /profile layout and its tabs both read it.
export const getLearnerProfile = cache(async (userId: string): Promise<LearnerProfile | null> => {
  const profile = await getProfileDetails(userId);
  if (!profile) return null;
  const supabase = await createClient();

  const [{ data: enrollments }, { data: progress }, { data: badgeRows }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("enrolled_at, course:courses(id, title, cover_url, level, skills, instructor:profiles!courses_instructor_id_fkey(full_name))")
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("lesson_progress")
      .select("completed_at, lesson:lessons(id, title, course_id, duration_seconds)")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false }),
    supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", userId).order("earned_at", { ascending: false }),
  ]);

  const rows = ((enrollments ?? []) as unknown as EnrollmentRow[]).filter((e) => e.course);
  const ids = rows.map((r) => r.course!.id);
  const { data: counts } = ids.length ? await supabase.rpc("course_lesson_counts", { p_course_ids: ids }) : { data: [] };
  const totalBy = new Map((counts ?? []).map((c) => [c.course_id, c.lesson_count]));
  // Module quizzes count as steps, and a course isn't complete until every one is passed.
  const { data: quizRows } = ids.length ? await supabase.rpc("quiz_progress", { p_user_id: userId, p_course_ids: ids }) : { data: [] };
  const quizBy = new Map((quizRows ?? []).map((q) => [q.course_id, q]));

  const enrolledIds = new Set(ids);
  const done = ((progress ?? []) as unknown as ProgressRow[]).filter((p) => p.lesson && enrolledIds.has(p.lesson.course_id));
  const doneBy = new Map<string, { n: number; last: string }>();
  for (const p of done) {
    const cur = doneBy.get(p.lesson!.course_id) ?? { n: 0, last: "" };
    cur.n += 1;
    if (p.completed_at > cur.last) cur.last = p.completed_at;
    doneBy.set(p.lesson!.course_id, cur);
  }

  const courses: ProfileCourse[] = rows
    .map((r) => {
      const c = r.course!;
      const total = totalBy.get(c.id) ?? 0;
      const d = doneBy.get(c.id);
      const n = d?.n ?? 0;
      return {
        id: c.id,
        title: c.title,
        coverUrl: c.cover_url,
        level: c.level,
        skills: c.skills ?? [],
        instructor: c.instructor?.full_name || "Etivio instructor",
        enrolledAt: r.enrolled_at,
        done: n,
        total,
        progress: percent(n + (quizBy.get(c.id)?.passed ?? 0), total + (quizBy.get(c.id)?.quizzes ?? 0)),
        completed: total > 0 && n >= total && (quizBy.get(c.id)?.passed ?? 0) >= (quizBy.get(c.id)?.quizzes ?? 0),
        lastActivity: d?.last || r.enrolled_at,
      };
    })
    .sort((a, b) => Number(a.completed) - Number(b.completed) || b.lastActivity.localeCompare(a.lastActivity));

  const titleBy = new Map(courses.map((c) => [c.id, c.title]));
  const recent = done.slice(0, 60).map((p) => ({
    lessonId: p.lesson!.id,
    lessonTitle: p.lesson!.title,
    courseId: p.lesson!.course_id,
    courseTitle: titleBy.get(p.lesson!.course_id) ?? "",
    at: p.completed_at,
  }));

  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const activeDays = new Set(done.filter((p) => Date.parse(p.completed_at) >= monthAgo).map((p) => p.completed_at.slice(0, 10))).size;

  return {
    profile,
    courses,
    recent,
    skills: skillsFrom(courses.filter((c) => c.completed)),
    badges: (badgeRows ?? []).map((b) => ({ id: b.badge_id as BadgeId, earnedAt: b.earned_at })),
    heatmap: buildHeatmap(dailyCounts(done.map((p) => p.completed_at)), new Date()),
    stats: {
      enrolled: courses.length,
      completed: courses.filter((c) => c.completed).length,
      lessonsDone: done.length,
      secondsLearned: done.reduce((s, p) => s + (p.lesson!.duration_seconds ?? 0), 0),
      activeDays,
    },
  };
});

// Distinct skills across courses, ordered by how many courses taught them.
export function skillsFrom(courses: { skills: string[] }[]) {
  const n = new Map<string, number>();
  for (const c of courses) for (const sk of c.skills) n.set(sk, (n.get(sk) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([sk]) => sk);
}
