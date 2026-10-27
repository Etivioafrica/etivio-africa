"use server";
import { redirect } from "next/navigation";
import { HOURS_LABELS, LEVEL_LABELS, TOPICS, parseGoals, type SkillLevel, type WeeklyHours } from "@/lib/learner-prefs";
import { getMyPrivateProfile } from "@/lib/my-profile";
import { after } from "next/server";
import { emailWelcome } from "@/lib/email/notify";
import { createClient } from "@/lib/supabase/server";
import type { BadgeId } from "@/lib/badges";
import type { Database } from "@/lib/database.types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Badges earned but not yet celebrated. Polled by the shell on each navigation (one indexed query).
export async function getUnseenBadges(): Promise<BadgeId[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("user_badges").select("badge_id").eq("user_id", user.id).is("seen_at", null).order("earned_at");
  return (data ?? []).map((r) => r.badge_id as BadgeId);
}

export async function markBadgesSeen(ids: BadgeId[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !ids.length) return;
  await supabase.from("user_badges").update({ seen_at: new Date().toISOString() }).eq("user_id", user.id).in("badge_id", ids);
}

export type OnboardingAnswers = {
  goals?: ("new_skill" | "career" | "creative" | "freelance" | "job")[];
  interests?: string[];
  level?: "beginner" | "intermediate" | "advanced" | "expert";
  hours?: "under_3" | "3_to_6" | "over_6";
};

// Hours a week → lessons-per-week goal.
const GOAL_FOR_HOURS = { under_3: 3, "3_to_6": 5, over_6: 7 } as const;

// The learner's current welcome-guide answers, to prefill the questions when they update them later.
export async function loadOnboarding(): Promise<OnboardingAnswers> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { interests: [] };
  const [{ data }, priv] = await Promise.all([supabase.from("profiles").select("interests").eq("id", user.id).single(), getMyPrivateProfile()]);
  const topics: readonly string[] = TOPICS;
  return {
    goals: parseGoals(priv?.learning_goal),
    interests: (data?.interests ?? []).filter((t) => topics.includes(t)),
    level: priv?.skill_level && priv.skill_level in LEVEL_LABELS ? (priv.skill_level as SkillLevel) : undefined,
    hours: priv?.weekly_hours && priv.weekly_hours in HOURS_LABELS ? (priv.weekly_hours as WeeklyHours) : undefined,
  };
}

// Saves the welcome guide. Skipping (no answers) still marks it done so it doesn't come back.
// `update` is a learner changing their answers later: picked topics replace the old ones (interests typed in
// Settings stay). No refresh() here: the guide shows its final screen first and refreshes when it closes.
export async function saveOnboarding(answers: OnboardingAnswers | null, update = false) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // The welcome email goes out the first time someone finishes (or skips) the welcome guide.
  const { data: before } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).maybeSingle();
  if (!update && before && !before.onboarded_at) after(() => emailWelcome(user.id));
  const patch: Database["public"]["Tables"]["profiles"]["Update"] = update ? {} : { onboarded_at: new Date().toISOString() };
  if (answers) {
    const goals = parseGoals(answers.goals?.join(","));
    if (goals.length) patch.learning_goal = [...new Set(goals)].join(",");
    if (answers.level) patch.skill_level = answers.level;
    if (answers.hours) {
      patch.weekly_hours = answers.hours;
      patch.weekly_goal = GOAL_FOR_HOURS[answers.hours];
    }
    if (answers.interests?.length) {
      const { data: p } = await supabase.from("profiles").select("interests").eq("id", user.id).single();
      const topics: readonly string[] = TOPICS;
      const kept = (p?.interests ?? []).filter((t) => !update || !topics.includes(t));
      patch.interests = [...new Set([...kept, ...answers.interests.map((t) => t.slice(0, 32))])].slice(0, 12);
    }
  }
  await supabase.from("profiles").update(patch).eq("id", user.id);
}
