import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/email/site";
import { REF_COOKIE, cleanRefCode } from "@/lib/referral";

// Referrals (migration 0060): everyone has an invite link; friends who sign up through it are linked to them, and
// both get wallet credit when the friend's first paid order clears (reward_referral, called from completeOrder).

export type ReferralTerms = { percent: number; capMinor: number; friendPercent: number; days: number };

export async function referralTerms(): Promise<ReferralTerms> {
  const { data } = await createAdminClient().from("platform_settings").select("referral_percent, referral_cap_minor, referral_friend_percent, referral_days").maybeSingle();
  return {
    percent: Number(data?.referral_percent ?? 10),
    capMinor: data?.referral_cap_minor ?? 500000,
    friendPercent: Number(data?.referral_friend_percent ?? 5),
    days: data?.referral_days ?? 90,
  };
}

export const inviteUrl = (code: string) => `${siteUrl()}/r/${code}`;

// Links a just-made account to the invite code waiting in its cookie (Google sign-ups; email sign-ups are linked by
// the database from their metadata). Does nothing for older accounts or ones already linked.
export async function claimReferralFromCookie(userId: string) {
  const store = await cookies();
  const code = cleanRefCode(store.get(REF_COOKIE)?.value);
  if (!code) return;
  const { data: linked } = await createAdminClient().rpc("claim_referral", { p_user: userId, p_code: code });
  if (linked) store.delete(REF_COOKIE);
}

// Who invited this visitor, for the sign-up page.
export async function inviterFromCookie() {
  const code = cleanRefCode((await cookies()).get(REF_COOKIE)?.value);
  if (!code) return null;
  const { data } = await createAdminClient().from("profiles").select("full_name, avatar_url, username").eq("referral_code", code).is("deleted_at", null).maybeSingle();
  return data ? { code, name: data.full_name?.trim() || "A friend", avatarUrl: data.avatar_url, seed: data.username ?? code } : null;
}

export type InvitedFriend = { id: string; name: string; avatarUrl: string | null; seed: string; joinedAt: string; earnedMinor: number };

export async function myReferrals(userId: string) {
  const db = createAdminClient();
  const [{ data: me }, { data: friends }, { data: credits }] = await Promise.all([
    db.from("profiles").select("referral_code").eq("id", userId).single(),
    db.from("profiles").select("id, full_name, avatar_url, username, referred_at").eq("referred_by", userId).order("referred_at", { ascending: false }).limit(200),
    db.from("wallet_transactions").select("amount_minor, referral_friend_id").eq("user_id", userId).eq("kind", "referral"),
  ]);
  const earnedBy = new Map<string, number>();
  for (const c of credits ?? []) if (c.referral_friend_id && c.referral_friend_id !== userId) earnedBy.set(c.referral_friend_id, (earnedBy.get(c.referral_friend_id) ?? 0) + c.amount_minor);
  const list: InvitedFriend[] = (friends ?? []).map((f) => ({
    id: f.id,
    name: f.full_name?.trim() || "New member",
    avatarUrl: f.avatar_url,
    seed: f.username ?? f.id,
    joinedAt: f.referred_at ?? "",
    earnedMinor: earnedBy.get(f.id) ?? 0,
  }));
  return {
    code: me?.referral_code ?? "",
    friends: list,
    bought: list.filter((f) => f.earnedMinor > 0).length,
    earnedMinor: [...earnedBy.values()].reduce((n, v) => n + v, 0),
  };
}
