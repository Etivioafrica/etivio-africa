import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaff, type AppRole } from "@/lib/roles";
import { FEED_PAGE, isCategory, type Category, type CommunityCard, type FeedPost, type JoinMode, type MemberRow, type Membership } from "./communities-shared";

export * from "./communities-shared";

// Communities (migration 0047). Everything is read with the service role after checking who's asking, so the rules
// live here: members see posts, owners and moderators (and Etivio staff) run the community.

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
    .select("id, slug, name, description, cover_url, owner_id, join_mode, course_id, join_question, invite_code, is_official, status, rules, created_at, course:courses(title, slug)")
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

// One page of the feed. The first page (no `before`) lists pinned posts first; later pages continue with older, unpinned
// posts. Posts held for a moderation check show only to whoever wrote them and to moderators (`seeHidden`).
export async function communityFeed(
  communityId: string,
  userId: string,
  seeHidden = false,
  { before, category, limit = FEED_PAGE }: { before?: string; category?: Category; limit?: number } = {},
): Promise<{ posts: FeedPost[]; hasMore: boolean }> {
  const db = createAdminClient();
  let q = db
    .from("community_posts")
    .select("id, body, image_url, category, pinned, hidden, created_at, edited_at, comment_count, like_count, author_id, author:profiles(full_name, avatar_url)")
    .eq("community_id", communityId);
  if (!seeHidden) q = q.or(`hidden.eq.false,author_id.eq.${userId}`);
  if (category) q = q.eq("category", category);
  if (before) q = q.eq("pinned", false).lt("created_at", before);
  const { data: rows } = await q.order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit + 1);
  const posts = (rows ?? []).slice(0, limit);
  const ids = posts.map((p) => p.id);
  const { data: liked } = ids.length ? await db.from("community_likes").select("post_id").eq("user_id", userId).in("post_id", ids) : { data: [] };
  const likedSet = new Set((liked ?? []).map((l) => l.post_id));
  return {
    hasMore: (rows ?? []).length > limit,
    posts: posts.map((p) => ({
      id: p.id,
      body: p.body,
      image: p.image_url,
      category: isCategory(p.category) ? p.category : "discussion",
      pinned: p.pinned,
      hidden: p.hidden,
      createdAt: p.created_at,
      editedAt: p.edited_at,
      comments: p.comment_count,
      likes: p.like_count,
      liked: likedSet.has(p.id),
      author: { id: p.author_id, name: p.author?.full_name || "Member", avatar: p.author?.avatar_url ?? null },
    })),
  };
}

// Everyone in the community, owner and moderators first (capped; communities are small).
export async function communityMembers(communityId: string, limit = 300): Promise<MemberRow[]> {
  const { data } = await createAdminClient()
    .from("community_members")
    .select("user_id, role, joined_at, profile:profiles(full_name, avatar_url)")
    .eq("community_id", communityId)
    .eq("status", "active")
    .order("joined_at")
    .limit(limit);
  const rank = { owner: 0, moderator: 1, member: 2 } as const;
  return (data ?? [])
    .map((m) => ({ userId: m.user_id, name: m.profile?.full_name || "Member", avatar: m.profile?.avatar_url ?? null, role: m.role as MemberRow["role"], joinedAt: m.joined_at }))
    .sort((x, y) => rank[x.role] - rank[y.role]);
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
