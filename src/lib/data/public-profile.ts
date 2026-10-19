import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileDetails } from "@/lib/data/profile";
import { readPrefs, skillsFrom } from "@/lib/data/profile";
import { buildHeatmap, dailyCounts, type Heatmap } from "@/lib/activity";
import type { BadgeId } from "@/lib/badges";

export type PublicCourse = { id: string; title: string; coverUrl: string | null; level: string; progress?: number };
export type PublicCertificate = { code: string; courseTitle: string; issuedAt: string };

export type PublicProfile = {
  profile: ProfileDetails;
  completed: PublicCourse[];
  teaching: PublicCourse[];
  // In-progress courses, only when the learner allows it.
  learning: PublicCourse[];
  certificates: PublicCertificate[];
  skills: string[];
  heatmap: Heatmap;
  latestBadge: { id: BadgeId; earnedAt: string } | null;
  stats: { completed: number; lessonsDone: number; secondsLearned: number; teaching: number };
};

// What anyone on the internet sees at /@username. Uses the service role because visitors may be
// signed out, so it must only ever return public-safe fields: no email, no in-progress or private courses.
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const db = createAdminClient();
  const { data: p } = await db
    .from("profiles")
    .select("id, username, profile_public, full_name, avatar_url, cover_url, bio, headline, location, website_url, linkedin_url, x_url, interests, created_at, status, show_current_learning")
    .eq("username", username)
    .is("deleted_at", null)
    .maybeSingle();
  if (!p || !p.profile_public || p.status !== "active") return null;

  const [{ data: enrollments }, { data: progress }, { data: taught }, { data: badge }, { data: certs }] = await Promise.all([
    db.from("enrollments").select("course:courses(id, title, cover_url, level, status, skills)").eq("user_id", p.id),
    db.from("lesson_progress").select("completed_at, lesson:lessons(course_id, duration_seconds)").eq("user_id", p.id),
    db
      .from("courses")
      .select("id, title, cover_url, level")
      .eq("instructor_id", p.id)
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    db.from("user_badges").select("badge_id, earned_at").eq("user_id", p.id).order("earned_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("certificates").select("code, course_title, issued_at").eq("user_id", p.id).order("issued_at", { ascending: false }),
  ]);

  const published = (enrollments ?? []).map((e) => e.course).filter((c) => c && c.status === "published") as {
    id: string;
    title: string;
    cover_url: string | null;
    level: string;
    skills: string[];
  }[];
  const ids = published.map((c) => c.id);
  const { data: counts } = ids.length ? await db.rpc("course_lesson_counts", { p_course_ids: ids }) : { data: [] };
  const totalBy = new Map((counts ?? []).map((c) => [c.course_id, c.lesson_count]));

  const lessons = (progress ?? []).map((r) => r.lesson).filter(Boolean) as { course_id: string; duration_seconds: number | null }[];
  const doneBy = new Map<string, number>();
  for (const l of lessons) doneBy.set(l.course_id, (doneBy.get(l.course_id) ?? 0) + 1);

  const toCourse = (c: { id: string; title: string; cover_url: string | null; level: string }) => ({
    id: c.id,
    title: c.title,
    coverUrl: c.cover_url,
    level: c.level,
  });
  const isDone = (c: { id: string }) => (totalBy.get(c.id) ?? 0) > 0 && (doneBy.get(c.id) ?? 0) >= totalBy.get(c.id)!;
  const completedRows = published.filter(isDone);
  const completed = completedRows.map(toCourse);
  const learning = p.show_current_learning
    ? published
        .filter((c) => !isDone(c))
        .map((c) => ({ ...toCourse(c), progress: Math.round(((doneBy.get(c.id) ?? 0) / Math.max(1, totalBy.get(c.id) ?? 0)) * 100) }))
    : [];
  const teaching = (taught ?? []).map(toCourse);

  return {
    profile: {
      id: p.id,
      username: p.username,
      profilePublic: p.profile_public,
      name: p.full_name || p.username || "Etivio learner",
      avatarUrl: p.avatar_url,
      coverUrl: p.cover_url,
      bio: p.bio,
      headline: p.headline,
      location: p.location,
      websiteUrl: p.website_url,
      linkedinUrl: p.linkedin_url,
      xUrl: p.x_url,
      interests: p.interests ?? [],
      notificationPrefs: readPrefs(null),
      joinedAt: p.created_at,
      weeklyGoal: null,
      showCurrentLearning: p.show_current_learning,
    },
    completed,
    teaching,
    learning,
    certificates: (certs ?? []).map((c) => ({ code: c.code, courseTitle: c.course_title, issuedAt: c.issued_at })),
    skills: skillsFrom(completedRows),
    latestBadge: badge ? { id: badge.badge_id as BadgeId, earnedAt: badge.earned_at } : null,
    heatmap: buildHeatmap(dailyCounts((progress ?? []).map((r) => r.completed_at)), new Date()),
    stats: {
      completed: completed.length,
      lessonsDone: lessons.length,
      secondsLearned: lessons.reduce((s, l) => s + (l.duration_seconds ?? 0), 0),
      teaching: teaching.length,
    },
  };
}
