import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaff, type AppRole } from "@/lib/roles";

// Communities (migration 0047). Everything is read with the service role after checking who's asking, so the rules
// live here: members see posts, owners and moderators (and Etivio staff) run the community.

export type JoinMode = "open" | "request" | "course" | "invite";
export type Membership = { role: "owner" | "moderator" | "member"; status: "active" | "pending" | "banned" } | null;

export const JOIN_LABEL: Record<JoinMode, string> = {
  open: "Anyone can join",
  request: "Request to join",
  course: "For students of a course",
  invite: "Invite only",
};

export type CommunityCard = { id: string; slug: string; name: string; description: string | null; coverUrl: string | null; joinMode: JoinMode; isOfficial: boolean; members: number; courseTitle: string | null; mine: Membership };

// Communities this person is in, and ones they could join (invite-only spaces stay hidden unless they're in them).
export async function listCommunities(userId: string) {
  const db = createAdminClient();
  const [{ data: rows }, { data: members }, { data: mine }] = await Promise.all([
    db.from("communities").select("id, slug, name, description, cover_url, join_mode, is_official, course:courses(title)").eq("status", "active").order("is_official", { ascending: false }).order("created_at"),
    db.from("community_members").select("community_id").eq("status", "active"),
    db.from("community_members").select("community_id, role, status").eq("user_id", userId),
  ]);
  const count = new Map<string, number>();
  for (const m of members ?? []) count.set(m.community_id, (count.get(m.community_id) ?? 0) + 1);
  const myRow = new Map((mine ?? []).map((m) => [m.community_id, { role: m.role, status: m.status } as Membership]));
  const cards: CommunityCard[] = (rows ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    coverUrl: c.cover_url,
    joinMode: c.join_mode as JoinMode,
    isOfficial: c.is_official,
    members: count.get(c.id) ?? 0,
    courseTitle: c.course?.title ?? null,
    mine: myRow.get(c.id) ?? null,
  }));
  return {
    joined: cards.filter((c) => c.mine?.status === "active"),
    discover: cards.filter((c) => c.mine?.status !== "active" && c.mine?.status !== "banned" && c.joinMode !== "invite"),
  };
}

// Tutors start communities (Etivio admins too, for official ones). Course-linked spaces must use a course they teach.
export function canCreateCommunity(roles: AppRole[]) {
  return roles.includes("tutor") || roles.includes("super_admin");
}

// One community for this viewer: details, their membership, and whether they can moderate.
export async function getCommunity(slug: string, userId: string, roles: AppRole[]) {
  const db = createAdminClient();
  const { data: c } = await db
    .from("communities")
    .select("id, slug, name, description, cover_url, owner_id, join_mode, course_id, join_question, invite_code, is_official, status, course:courses(title, slug)")
    .eq("slug", slug)
    .maybeSingle();
  if (!c || (c.status !== "active" && !isStaff(roles))) return null;
  const [{ data: me }, { count: members }] = await Promise.all([
    db.from("community_members").select("role, status").eq("community_id", c.id).eq("user_id", userId).maybeSingle(),
    db.from("community_members").select("user_id", { count: "exact", head: true }).eq("community_id", c.id).eq("status", "active"),
  ]);
  const mine = (me as Membership) ?? null;
  const canModerate = isStaff(roles) || (mine?.status === "active" && (mine.role === "owner" || mine.role === "moderator"));
  return { ...c, joinMode: c.join_mode as JoinMode, mine, canModerate, isMember: mine?.status === "active" || isStaff(roles), members: members ?? 0 };
}

export type FeedPost = { id: string; body: string; pinned: boolean; createdAt: string; comments: number; likes: number; liked: boolean; author: { id: string | null; name: string; avatar: string | null } };

export async function communityFeed(communityId: string, userId: string, limit = 50): Promise<FeedPost[]> {
  const db = createAdminClient();
  const { data: posts } = await db
    .from("community_posts")
    .select("id, body, pinned, created_at, comment_count, like_count, author_id, author:profiles(full_name, avatar_url)")
    .eq("community_id", communityId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  const ids = (posts ?? []).map((p) => p.id);
  const { data: liked } = ids.length ? await db.from("community_likes").select("post_id").eq("user_id", userId).in("post_id", ids) : { data: [] };
  const likedSet = new Set((liked ?? []).map((l) => l.post_id));
  return (posts ?? []).map((p) => ({
    id: p.id,
    body: p.body,
    pinned: p.pinned,
    createdAt: p.created_at,
    comments: p.comment_count,
    likes: p.like_count,
    liked: likedSet.has(p.id),
    author: { id: p.author_id, name: p.author?.full_name || "Member", avatar: p.author?.avatar_url ?? null },
  }));
}

export async function pendingRequests(communityId: string) {
  const { data } = await createAdminClient()
    .from("community_members")
    .select("user_id, answer, joined_at, profile:profiles(full_name, avatar_url)")
    .eq("community_id", communityId)
    .eq("status", "pending")
    .order("joined_at");
  return (data ?? []).map((m) => ({ userId: m.user_id, answer: m.answer, at: m.joined_at, name: m.profile?.full_name || "Member", avatar: m.profile?.avatar_url ?? null }));
}
