import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getMyPrivateProfile } from "@/lib/my-profile";
import { getCatalog, getMyCourses, type CourseCard } from "@/lib/data/learn";
import type { LearningGoal, SkillLevel } from "@/lib/learner-prefs";

export type LearnerPrefs = { interests: string[]; level: SkillLevel | null; goal: LearningGoal | null; weeklyGoal: number | null };

export const getLearnerPrefs = cache(async (): Promise<LearnerPrefs> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data }, priv] = await Promise.all([supabase.from("profiles").select("interests").eq("id", user.id).single(), getMyPrivateProfile()]);
  return {
    interests: data?.interests ?? [],
    level: (priv?.skill_level as SkillLevel | null) ?? null,
    goal: (priv?.learning_goal as LearningGoal | null) ?? null,
    weeklyGoal: priv?.weekly_goal ?? null,
  };
});

// How well a course's level suits the learner's own level (higher is better).
const LEVEL_FIT: Record<SkillLevel, Record<string, number>> = {
  beginner: { beginner: 2, intermediate: 0.5, advanced: -1 },
  intermediate: { beginner: 0.5, intermediate: 2, advanced: 1 },
  advanced: { beginner: -1, intermediate: 1, advanced: 2 },
  expert: { beginner: -1, intermediate: 0.5, advanced: 2 },
};

export type Recommendation = CourseCard & { reason: string | null };

// Ranks published courses the learner isn't taking: topic match (course category, then skills) first,
// then how well the course level fits their skill level, then newest. Explains the top reason per course.
export async function getRecommendations(limit = 6): Promise<Recommendation[]> {
  const [prefs, catalog, mine] = await Promise.all([getLearnerPrefs(), getCatalog(120), getMyCourses()]);
  const enrolled = new Set(mine.map((c) => c.id));
  const topics = new Set(prefs.interests.map((t) => t.toLowerCase()));

  return catalog
    .filter((c) => !enrolled.has(c.id))
    .map((c, i) => {
      const categoryHit = c.category && topics.has(c.category.toLowerCase());
      const skillHit = c.skills.find((s) => topics.has(s.toLowerCase()));
      const fit = prefs.level ? (LEVEL_FIT[prefs.level][c.level] ?? 0) : 0;
      const score = (categoryHit ? 4 : 0) + (skillHit ? 2 : 0) + fit - i * 0.001; // catalog is newest-first
      const reason = categoryHit
        ? `Because you're into ${c.category}`
        : skillHit
          ? `Teaches ${skillHit}`
          : prefs.level && fit >= 2
            ? `Matches your ${prefs.level} level`
            : null;
      return { course: { ...c, reason }, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.course);
}
