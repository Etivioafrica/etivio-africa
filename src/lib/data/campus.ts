import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { featureOn } from "@/lib/data/features";
import type { AppRole } from "@/lib/roles";
import type { CampusJob, CampusLink } from "@/app/(app)/campus/job";

// Campus (migration 0051): the shared feed for every learner, after the old app's In-House feed. Reads go through the
// service role with the viewer passed in, so held posts and comments only show to whoever wrote them (and staff).

export type CampusKind = "update" | "question" | "win" | "poll" | "opportunity";
export type CampusSort = "latest" | "hot" | "top";

export const CAMPUS_KINDS: { value: CampusKind; label: string; plural: string }[] = [
  { value: "update", label: "Update", plural: "Updates" },
  { value: "question", label: "Question", plural: "Questions" },
  { value: "win", label: "Win", plural: "Wins" },
  { value: "poll", label: "Poll", plural: "Polls" },
  { value: "opportunity", label: "Opportunity", plural: "Opportunities" },
];

export type CampusAuthor = { id: string; name: string; username: string | null; avatar: string | null; badge: string | null };
export type CampusPoll = { options: { id: string; label: string; votes: number }[]; multiple: boolean; endsAt: string | null; closed: boolean; mine: string[]; total: number };
export type CampusQuote = { id: string; kind: CampusKind; body: string; imageUrl: string | null; createdAt: string; author: CampusAuthor };
export type CampusPost = {
  id: string;
  kind: CampusKind;
  body: string;
  imageUrl: string | null;
  videoUrl: string | null;
  hashtags: string[];
  createdAt: string;
  hidden: boolean;
  likes: number;
  comments: number;
  quotes: number;
  liked: boolean;
  saved: boolean;
  author: CampusAuthor;
  poll: CampusPoll | null;
  quoted: CampusQuote | null;
  // The post this one quoted was deleted.
  quoteGone: boolean;
  link: CampusLink | null;
  job: CampusJob | null;
  reposts: number;
  reposted: boolean;
  // A plain repost: the original post, shown whole.
  repostOf: CampusPost | null;
  // The posts that follow this one in a thread, in order.
  thread: string[];
};
export type CampusComment = { id: string; parentId: string | null; body: string; createdAt: string; hidden: boolean; author: CampusAuthor };

export type Viewer = { id: string; staff: boolean };

const POST_FIELDS = "id, author_id, kind, body, image_url, video_url, quoted_post_id, hashtags, poll_multiple, poll_ends_at, like_count, comment_count, quote_count, hidden, created_at, link, job, repost_of, repost_count, thread";
type PostRow = {
  id: string;
  author_id: string;
  kind: string;
  body: string;
  image_url: string | null;
  video_url: string | null;
  quoted_post_id: string | null;
  hashtags: string[];
  poll_multiple: boolean;
  poll_ends_at: string | null;
  like_count: number;
  comment_count: number;
  quote_count: number;
  hidden: boolean;
  created_at: string;
  link: unknown;
  job: unknown;
  repost_of: string | null;
  repost_count: number;
  thread: string[] | null;
};

export const campusOn = () => featureOn("campus");

// Names, usernames, photos and a one-word badge (Tutor, Etivio team) for these people.
async function authors(ids: string[]): Promise<Map<string, CampusAuthor>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const db = createAdminClient();
  const [{ data: people }, { data: roles }] = await Promise.all([
    db.from("profiles").select("id, full_name, username, avatar_url").in("id", unique),
    db.from("user_roles").select("user_id, role").in("user_id", unique),
  ]);
  const roleMap = new Map<string, AppRole[]>();
  for (const r of roles ?? []) roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role as AppRole]);
  const badge = (rs: AppRole[]) => (rs.includes("super_admin") ? "Etivio team" : rs.includes("tutor") ? "Tutor" : rs.includes("coach") ? "Coach" : null);
  return new Map(
    (people ?? []).map((p) => [p.id, { id: p.id, name: p.full_name || p.username || "Etivio learner", username: p.username, avatar: p.avatar_url, badge: badge(roleMap.get(p.id) ?? []) }]),
  );
}

const nobody = (id: string): CampusAuthor => ({ id, name: "Etivio learner", username: null, avatar: null, badge: null });

const visible = (r: PostRow, viewer: Viewer) => !r.hidden || r.author_id === viewer.id || viewer.staff;

// Turns rows into posts for this viewer: authors, likes, saves, polls and quoted posts in a few queries.
// Plain reposts carry the whole original (one level deep), and are dropped if the original can't be seen.
async function hydrate(rows: PostRow[], viewer: Viewer, nested = false): Promise<CampusPost[]> {
  if (!rows.length) return [];
  const db = createAdminClient();
  const originalIds = nested ? [] : [...new Set(rows.map((r) => r.repost_of).filter(Boolean))] as string[];
  const { data: originalRows } = originalIds.length ? await db.from("campus_posts").select(POST_FIELDS).in("id", originalIds) : { data: [] };
  const originals = new Map((await hydrate(((originalRows ?? []) as PostRow[]).filter((r) => visible(r, viewer)), viewer, true)).map((p) => [p.id, p]));
  rows = rows.filter((r) => !r.repost_of || originals.has(r.repost_of));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const quotedIds = [...new Set(rows.map((r) => r.quoted_post_id).filter(Boolean))] as string[];
  const pollIds = rows.filter((r) => r.kind === "poll").map((r) => r.id);
  const [{ data: liked }, { data: saved }, { data: options }, { data: votes }, { data: quoted }, { data: reposted }] = await Promise.all([
    db.from("campus_likes").select("post_id").eq("user_id", viewer.id).in("post_id", ids),
    db.from("campus_saves").select("post_id").eq("user_id", viewer.id).in("post_id", ids),
    pollIds.length ? db.from("campus_poll_options").select("id, post_id, position, label, vote_count").in("post_id", pollIds).order("position") : Promise.resolve({ data: [] }),
    pollIds.length ? db.from("campus_poll_votes").select("option_id, post_id").eq("user_id", viewer.id).in("post_id", pollIds) : Promise.resolve({ data: [] }),
    quotedIds.length ? db.from("campus_posts").select(POST_FIELDS).in("id", quotedIds) : Promise.resolve({ data: [] }),
    db.from("campus_posts").select("repost_of").eq("author_id", viewer.id).in("repost_of", ids),
  ]);
  const quotedRows = ((quoted ?? []) as PostRow[]).filter((q) => visible(q, viewer));
  const repostedSet = new Set((reposted ?? []).map((r) => r.repost_of));
  const people = await authors([...rows.map((r) => r.author_id), ...quotedRows.map((q) => q.author_id)]);
  const likedSet = new Set((liked ?? []).map((l) => l.post_id));
  const savedSet = new Set((saved ?? []).map((s) => s.post_id));
  const quoteMap = new Map(quotedRows.map((q) => [q.id, q]));

  return rows.map((r) => {
    const opts = (options ?? []).filter((o) => o.post_id === r.id);
    const q = r.quoted_post_id ? quoteMap.get(r.quoted_post_id) : undefined;
    return {
      id: r.id,
      kind: r.kind as CampusKind,
      body: r.body,
      imageUrl: r.image_url,
      videoUrl: r.video_url,
      hashtags: r.hashtags,
      createdAt: r.created_at,
      hidden: r.hidden,
      likes: r.like_count,
      comments: r.comment_count,
      quotes: r.quote_count,
      liked: likedSet.has(r.id),
      saved: savedSet.has(r.id),
      author: people.get(r.author_id) ?? nobody(r.author_id),
      poll:
        r.kind === "poll" && opts.length
          ? {
              options: opts.map((o) => ({ id: o.id, label: o.label, votes: o.vote_count })),
              multiple: r.poll_multiple,
              endsAt: r.poll_ends_at,
              closed: !!r.poll_ends_at && Date.parse(r.poll_ends_at) < Date.now(),
              mine: (votes ?? []).filter((v) => v.post_id === r.id).map((v) => v.option_id),
              total: opts.reduce((n, o) => n + o.vote_count, 0),
            }
          : null,
      quoted: q ? { id: q.id, kind: q.kind as CampusKind, body: q.body, imageUrl: q.image_url, createdAt: q.created_at, author: people.get(q.author_id) ?? nobody(q.author_id) } : null,
      quoteGone: !!r.quoted_post_id && !q,
      link: (r.link as CampusLink | null) ?? null,
      job: (r.job as CampusJob | null) ?? null,
      thread: r.thread ?? [],
      reposts: r.repost_count,
      reposted: repostedSet.has(r.id),
      repostOf: r.repost_of ? (originals.get(r.repost_of) ?? null) : null,
    };
  });
}

export type FeedQuery = { kind?: CampusKind; tag?: string; search?: string; sort?: CampusSort; saved?: boolean; authorId?: string; before?: string };
export const FEED_PAGE = 20;

// One page of the feed. Latest pages by time (`before`); Hot and Top rank the last few weeks.
export async function campusFeed(viewer: Viewer, q: FeedQuery = {}): Promise<{ posts: CampusPost[]; more: boolean }> {
  const db = createAdminClient();
  const sort = q.sort ?? "latest";
  let ids: string[] | null = null;
  if (q.saved) {
    const { data } = await db.from("campus_saves").select("post_id").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(200);
    ids = (data ?? []).map((s) => s.post_id);
    if (!ids.length) return { posts: [], more: false };
  }
  let query = db.from("campus_posts").select(POST_FIELDS);
  if (ids) query = query.in("id", ids);
  if (q.kind) query = query.eq("kind", q.kind);
  if (q.tag) query = query.contains("hashtags", [q.tag.toLowerCase()]);
  if (q.authorId) query = query.eq("author_id", q.authorId);
  if (q.search) query = query.ilike("body", `%${q.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (!viewer.staff) query = query.or(`hidden.eq.false,author_id.eq.${viewer.id}`);

  if (sort === "latest") {
    if (q.before) query = query.lt("created_at", q.before);
    const { data } = await query.order("created_at", { ascending: false }).limit(FEED_PAGE + 1);
    const rows = (data ?? []) as PostRow[];
    return { posts: await hydrate(rows.slice(0, FEED_PAGE), viewer), more: rows.length > FEED_PAGE };
  }

  const since = new Date(Date.now() - (sort === "hot" ? 14 : 30) * 86_400_000).toISOString();
  const { data } = await query.gte("created_at", since).order("like_count", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  let rows = (data ?? []) as PostRow[];
  if (sort === "hot") {
    // Likes and comments, fading with age (the old In-House formula).
    const score = (r: PostRow) => (r.like_count + r.comment_count * 2 + 1) / Math.pow((Date.now() - Date.parse(r.created_at)) / 3_600_000 + 2, 1.5);
    rows = rows.sort((a, b) => score(b) - score(a));
  }
  return { posts: await hydrate(rows.slice(0, 50), viewer), more: false };
}

export async function campusPost(id: string, viewer: Viewer) {
  const { data } = await createAdminClient().from("campus_posts").select(POST_FIELDS).eq("id", id).maybeSingle();
  const row = data as PostRow | null;
  if (!row || !visible(row, viewer)) return null;
  return (await hydrate([row], viewer))[0];
}

export async function campusComments(postId: string, viewer: Viewer): Promise<CampusComment[]> {
  const { data } = await createAdminClient().from("campus_comments").select("id, parent_id, author_id, body, hidden, created_at").eq("post_id", postId).order("created_at").limit(500);
  const rows = (data ?? []).filter((c) => !c.hidden || c.author_id === viewer.id || viewer.staff);
  const people = await authors(rows.map((c) => c.author_id));
  return rows.map((c) => ({ id: c.id, parentId: c.parent_id, body: c.body, createdAt: c.created_at, hidden: c.hidden, author: people.get(c.author_id) ?? nobody(c.author_id) }));
}

// The side column: trending hashtags this week, the latest from Etivio's blog, and how many people are on Campus.
export async function campusSidebar() {
  const db = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: recent }, { data: blog }, { count: members }, { data: faces }] = await Promise.all([
    db.from("campus_posts").select("hashtags").eq("hidden", false).gte("created_at", weekAgo).limit(500),
    db.from("blog_posts").select("title, slug, published_at, cover_url").eq("status", "published").order("published_at", { ascending: false }).limit(3),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("profiles").select("full_name, avatar_url").eq("status", "active").not("avatar_url", "is", null).order("created_at", { ascending: false }).limit(4),
  ]);
  const counts = new Map<string, number>();
  for (const p of recent ?? []) for (const t of p.hashtags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const trending = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, posts]) => ({ tag, posts }));
  return { trending, blog: blog ?? [], members: members ?? 0, faces: (faces ?? []).map((f) => ({ name: f.full_name ?? "", avatar: f.avatar_url })) };
}

// Sidebar extras: questions nobody has answered yet and the newest opportunities.
export async function campusSideFeeds() {
  const db = createAdminClient();
  const fortnight = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [{ data: asks }, { data: opps }] = await Promise.all([
    db.from("campus_posts").select("id, author_id, body, created_at").eq("kind", "question").eq("hidden", false).eq("comment_count", 0).is("repost_of", null).gte("created_at", fortnight).order("created_at", { ascending: false }).limit(4),
    db.from("campus_posts").select("id, author_id, body, job, created_at").eq("kind", "opportunity").eq("hidden", false).is("repost_of", null).order("created_at", { ascending: false }).limit(4),
  ]);
  const ids = [...new Set([...(asks ?? []), ...(opps ?? [])].map((p) => p.author_id))];
  const { data: people } = ids.length ? await db.from("profiles").select("id, full_name, avatar_url").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, { name: p.full_name ?? "", avatar: p.avatar_url }]));
  const author = (id: string) => who.get(id) ?? { name: "", avatar: null };
  return {
    unanswered: (asks ?? []).map((p) => ({ id: p.id, body: p.body, createdAt: p.created_at, author: author(p.author_id) })),
    opportunities: (opps ?? []).map((p) => ({ id: p.id, body: p.body, job: (p.job as CampusJob | null) ?? null, createdAt: p.created_at, author: author(p.author_id) })),
  };
}
