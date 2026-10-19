"use server";
import { redirect } from "next/navigation";
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
  goal?: "new_skill" | "career" | "creative" | "freelance" | "job";
  interests?: string[];
  level?: "beginner" | "intermediate" | "advanced" | "expert";
  hours?: "under_3" | "3_to_6" | "over_6";
};

// Hours a week → lessons-per-week goal.
const GOAL_FOR_HOURS = { under_3: 3, "3_to_6": 5, over_6: 7 } as const;

// Saves the welcome guide. Skipping (no answers) still marks it done so it doesn't come back.
// No refresh() here: the guide shows its final screen first and refreshes when it closes.
export async function saveOnboarding(answers: OnboardingAnswers | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // The welcome email goes out the first time someone finishes (or skips) the welcome guide.
  const { data: before } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).maybeSingle();
  if (before && !before.onboarded_at) after(() => emailWelcome(user.id));
  const update: Database["public"]["Tables"]["profiles"]["Update"] = { onboarded_at: new Date().toISOString() };
  if (answers) {
    if (answers.goal) update.learning_goal = answers.goal;
    if (answers.level) update.skill_level = answers.level;
    if (answers.hours) {
      update.weekly_hours = answers.hours;
      update.weekly_goal = GOAL_FOR_HOURS[answers.hours];
    }
    if (answers.interests?.length) {
      const { data: p } = await supabase.from("profiles").select("interests").eq("id", user.id).single();
      update.interests = [...new Set([...(p?.interests ?? []), ...answers.interests.map((t) => t.slice(0, 32))])].slice(0, 12);
    }
  }
  await supabase.from("profiles").update(update).eq("id", user.id);
}
