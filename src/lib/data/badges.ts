import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLearnerProfile } from "@/lib/data/profile";
import { allBadges, type BadgeId } from "@/lib/badges";

// Records any badges the learner has newly earned. Granted with the service role so nobody can award themselves one.
// Returns the ids that were new this time.
export async function syncBadges(userId: string): Promise<BadgeId[]> {
  const data = await getLearnerProfile(userId);
  if (!data) return [];
  const earned = allBadges({
    joinedAt: data.profile.joinedAt,
    lessonsDone: data.stats.lessonsDone,
    coursesCompleted: data.stats.completed,
    longestStreak: data.heatmap.longestStreak,
  })
    .filter((b) => b.earned)
    .map((b) => b.badge.id);

  const have = new Set(data.badges.map((b) => b.id));
  const fresh = earned.filter((id) => !have.has(id));
  if (!fresh.length) return [];
  await createAdminClient()
    .from("user_badges")
    .upsert(
      fresh.map((badge_id) => ({ user_id: userId, badge_id })),
      { onConflict: "user_id,badge_id", ignoreDuplicates: true },
    );
  return fresh;
}
