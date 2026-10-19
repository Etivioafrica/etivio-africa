"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BadgeId } from "@/lib/badges";

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
