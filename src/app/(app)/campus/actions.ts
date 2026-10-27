"use server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObject, keyFromUrl } from "@/lib/r2";
import { isStaff } from "@/lib/roles";
import { moderate } from "@/lib/moderation";
import { fetchLinkMeta } from "@/lib/link-meta";
import { CAMPUS_KINDS, campusComments, campusFeed, campusOn, type CampusKind, type FeedQuery } from "@/lib/data/campus";
import { JOB_PAY, JOB_TYPE, type CampusJob, type CampusLink } from "./job";

type Result = { ok?: string; error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YOUTUBE = /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}/;
// Posts an hour per person, to keep spam out.
const HOURLY_POSTS = 10;

async function member() {
  const user = await getCurrentUser();
  if (!(await campusOn())) throw new Error("Campus isn't available right now.");
  return { user, viewer: { id: user.id, staff: isStaff(user.roles) }, db: createAdminClient() };
}

// @usernames in a post or comment, lowercased, at most 10.
const mentionsIn = (text: string) => [...new Set([...text.matchAll(/(?:^|[^\w@])@([a-z0-9_.]{2,30})/gi)].map((m) => m[1].toLowerCase().replace(/\.+$/, "")))].slice(0, 10);

// Tells people about a Campus post or comment: whoever it replies to, and everyone @mentioned. One notification per
// person (a reply beats a mention), never to the writer. Held posts (waiting for a moderation check) notify nobody.
async function notifyCampus(
  db: ReturnType<typeof createAdminClient>,
  { from, fromName, postId, text, replyTo }: { from: string; fromName: string; postId: string; text: string; replyTo: { userId: string; title: string }[] },
) {
  const href = `/campus/${postId}`;
  const body = text.slice(0, 200);
  const sent = new Set([from]);
  const rows: { user_id: string; kind: string; title: string; body: string; href: string }[] = [];
  for (const r of replyTo) {
    if (sent.has(r.userId)) continue;
    sent.add(r.userId);
    rows.push({ user_id: r.userId, kind: "reply", title: r.title, body, href });
  }
  const names = mentionsIn(text);
  if (names.length) {
    const { data: people } = await db.from("profiles").select("id, username").in("username", names).eq("status", "active");
    for (const p of people ?? []) {
      if (sent.has(p.id)) continue;
      sent.add(p.id);
      rows.push({ user_id: p.id, kind: "mention", title: `${fromName} mentioned you`, body, href });
    }
  }
  if (rows.length) await db.from("notifications").insert(rows);
}

// #hashtags in a post, lowercased, at most 10.
const tagsIn = (text: string) => [...new Set([...text.matchAll(/(?:^|[^\w&])#([a-z0-9_]{2,30})/gi)].map((m) => m[1].toLowerCase()))].slice(0, 10);

export type NewPost = {
  kind: CampusKind;
  body: string;
  imageUrl?: string;
  videoUrl?: string;
  quotedId?: string;
  poll?: { options: string[]; multiple: boolean; days: number };
  job?: CampusJob;
  // The web link to show as a card (one that's in the text), or null when the card was removed.
  linkUrl?: string | null;
  // The posts that follow this one, for a thread.
  thread?: string[];
};

// Link cards fetched while someone types are kept for a while, so posting doesn't fetch the page again.
const linkCache = new Map<string, { at: number; link: CampusLink | null }>();

async function linkCard(url: string): Promise<CampusLink | null> {
  const hit = linkCache.get(url);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.link;
  const meta = await fetchLinkMeta(url);
  const link = meta.error || !meta.title ? null : { url, title: meta.title.slice(0, 200), description: meta.description.slice(0, 300), image: meta.image.slice(0, 500), site: meta.siteName };
  if (linkCache.size > 500) linkCache.clear();
  linkCache.set(url, { at: Date.now(), link });
  return link;
}

export async function previewCampusLink(url: string) {
  await member();
  if (!/^https?:\/\/\S+$/.test(url) || url.length > 500) return null;
  return linkCard(url);
}

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// Opportunity details, cleaned. Returns an error for a bad email or link.
function cleanJob(input: CampusJob | undefined): { job?: CampusJob; error?: string } {
  if (!input) return {};
  const job: CampusJob = {
    pay: JOB_PAY.some((p) => p.value === input.pay) ? input.pay : "paid",
    title: clip(input.title, 100),
    company: clip(input.company, 100),
    salary: clip(input.salary, 80),
    location: clip(input.location, 80),
    remote: !!input.remote,
    type: JOB_TYPE.some((t) => t.value === input.type) ? input.type : "",
    email: clip(input.email, 120).toLowerCase(),
    url: clip(input.url, 300),
  };
  if (job.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.email)) return { error: "Check the contact email." };
  if (job.url && !/^https?:\/\/[^\s.]+\.\S+$/.test(job.url)) return { error: "The application link should start with https://" };
  return { job };
}

export async function createCampusPost(input: NewPost): Promise<Result & { id?: string }> {
  const { user, db } = await member();
  const kind = CAMPUS_KINDS.some((k) => k.value === input.kind) ? input.kind : "update";
  const body = String(input.body ?? "").trim().slice(0, 5000);
  const thread = kind === "poll" || kind === "opportunity" ? [] : (input.thread ?? []).map((t) => String(t ?? "").trim().slice(0, 5000)).filter(Boolean).slice(0, 24);
  const image = input.imageUrl && keyFromUrl(input.imageUrl)?.startsWith("posts/") ? input.imageUrl : null;
  const video = input.videoUrl?.trim() || null;
  if (video && !YOUTUBE.test(video)) return { error: "Videos are YouTube links (youtube.com or youtu.be)." };
  const quotedId = input.quotedId && UUID.test(input.quotedId) ? input.quotedId : null;
  const options = kind === "poll" ? (input.poll?.options ?? []).map((o) => String(o).trim().slice(0, 80)).filter(Boolean) : [];
  if (kind === "poll" && (options.length < 2 || options.length > 4)) return { error: "A poll needs 2 to 4 options." };
  if (kind === "poll" && !body) return { error: "Ask the poll question." };
  if (!body && !image && !video && !quotedId) return { error: "Write something first." };
  if (thread.length && !body) return { error: "Write the first post of the thread." };
  const { job, error: jobError } = kind === "opportunity" ? cleanJob(input.job) : {};
  if (jobError) return { error: jobError };

  const { count } = await db.from("campus_posts").select("id", { count: "exact", head: true }).eq("author_id", user.id).gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= HOURLY_POSTS) return { error: "You've posted a lot in the last hour. Take a break and try again later." };
  if (quotedId) {
    const { data: q } = await db.from("campus_posts").select("id, hidden").eq("id", quotedId).maybeSingle();
    if (!q || q.hidden) return { error: "The post you're quoting is no longer there." };
  }

  const linkUrl = input.linkUrl && body.includes(input.linkUrl) && !image && !video && !quotedId ? input.linkUrl : null;
  const link = linkUrl ? await linkCard(linkUrl) : null;
  const check = await moderate("campus_post", user.id, [body, ...thread, ...options, ...(job ? [job.title, job.company, job.salary, job.location] : []), link?.title ?? ""]);
  if (check.error) return { error: check.error };
  const days = Math.min(14, Math.max(1, Math.round(Number(input.poll?.days) || 3)));
  const { data, error } = await db
    .from("campus_posts")
    .insert({
      author_id: user.id,
      kind,
      body,
      image_url: image,
      video_url: video,
      quoted_post_id: quotedId,
      hashtags: tagsIn([body, ...thread].join("\n")),
      thread,
      poll_multiple: kind === "poll" && !!input.poll?.multiple,
      poll_ends_at: kind === "poll" ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
      hidden: check.hold,
      link,
      job: job ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't post. Try again." };
  if (options.length) await db.from("campus_poll_options").insert(options.map((label, position) => ({ post_id: data.id, position, label })));
  await check.record(data.id);
  if (!check.hold) after(() => notifyCampus(db, { from: user.id, fromName: user.name || "Someone", postId: data.id, text: body, replyTo: [] }));
  refresh();
  return { id: data.id, ok: check.hold ? "Posted. Others will see it once the team has checked it." : "Posted." };
}

export async function deleteCampusPost(id: string): Promise<Result> {
  const { user, viewer, db } = await member();
  const { data: post } = await db.from("campus_posts").select("author_id, image_url").eq("id", id).maybeSingle();
  if (!post || (post.author_id !== user.id && !viewer.staff)) return { error: "You can't delete this post." };
  await db.from("campus_posts").delete().eq("id", id);
  if (post.image_url) await deleteObject(keyFromUrl(post.image_url)).catch(() => {});
  refresh();
  return { ok: "Post deleted." };
}

// Reposts a post as it is, or takes the repost back.
export async function toggleCampusRepost(postId: string): Promise<{ reposted?: boolean; error?: string }> {
  const { user, viewer, db } = await member();
  if (!UUID.test(postId)) return { error: "That post is no longer there." };
  const { data: had } = await db.from("campus_posts").select("id").eq("author_id", user.id).eq("repost_of", postId).maybeSingle();
  if (had) {
    await db.from("campus_posts").delete().eq("id", had.id);
    return { reposted: false };
  }
  const { data: post } = await db.from("campus_posts").select("kind, hidden, author_id, repost_of").eq("id", postId).maybeSingle();
  if (!post || post.repost_of || (post.hidden && post.author_id !== user.id && !viewer.staff)) return { error: "That post is no longer there." };
  const { error } = await db.from("campus_posts").insert({ author_id: user.id, kind: post.kind, body: "", repost_of: postId });
  if (error) return { error: "Couldn't repost. Try again." };
  return { reposted: true };
}

export async function toggleCampusLike(postId: string): Promise<{ liked?: boolean; error?: string }> {
  const { user, db } = await member();
  const { data: had } = await db.from("campus_likes").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  if (had) await db.from("campus_likes").delete().eq("post_id", postId).eq("user_id", user.id);
  else {
    const { error } = await db.from("campus_likes").insert({ post_id: postId, user_id: user.id });
    if (error) return { error: "That post is no longer there." };
  }
  return { liked: !had };
}

export async function toggleCampusSave(postId: string): Promise<{ saved?: boolean; error?: string }> {
  const { user, db } = await member();
  const { data: had } = await db.from("campus_saves").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  if (had) await db.from("campus_saves").delete().eq("post_id", postId).eq("user_id", user.id);
  else {
    const { error } = await db.from("campus_saves").insert({ post_id: postId, user_id: user.id });
    if (error) return { error: "That post is no longer there." };
  }
  return { saved: !had };
}

// Casts (or changes) this person's vote. `optionIds` is one option, or several on a multiple-choice poll.
export async function voteCampusPoll(postId: string, optionIds: string[]): Promise<Result> {
  const { user, db } = await member();
  const { data: post } = await db.from("campus_posts").select("kind, poll_multiple, poll_ends_at").eq("id", postId).maybeSingle();
  if (!post || post.kind !== "poll") return { error: "That poll is no longer there." };
  if (post.poll_ends_at && Date.parse(post.poll_ends_at) < Date.now()) return { error: "This poll has closed." };
  const { data: opts } = await db.from("campus_poll_options").select("id").eq("post_id", postId);
  const valid = new Set((opts ?? []).map((o) => o.id));
  const chosen = [...new Set(optionIds)].filter((id) => valid.has(id)).slice(0, post.poll_multiple ? 4 : 1);
  await db.from("campus_poll_votes").delete().eq("post_id", postId).eq("user_id", user.id);
  if (chosen.length) await db.from("campus_poll_votes").insert(chosen.map((option_id) => ({ option_id, post_id: postId, user_id: user.id })));
  refresh();
  return { ok: "Vote saved." };
}

export async function addCampusComment(postId: string, body: string, parentId: string | null) {
  const { user, viewer, db } = await member();
  const text = String(body ?? "").trim().slice(0, 2000);
  if (!text) return { error: "Write a comment first." };
  const { data: post } = await db.from("campus_posts").select("id, hidden, author_id").eq("id", postId).maybeSingle();
  if (!post || (post.hidden && post.author_id !== user.id && !viewer.staff)) return { error: "That post is no longer there." };
  // Replies are one level deep: a reply to a reply joins the same thread.
  let parent: string | null = null;
  let parentAuthor: string | null = null;
  if (parentId && UUID.test(parentId)) {
    const { data: p } = await db.from("campus_comments").select("id, parent_id, author_id").eq("id", parentId).eq("post_id", postId).maybeSingle();
    parent = p ? (p.parent_id ?? p.id) : null;
    parentAuthor = p?.author_id ?? null;
  }
  const check = await moderate("campus_comment", user.id, [text], `/campus/${postId}`);
  if (check.error) return { error: check.error };
  const { data, error } = await db.from("campus_comments").insert({ post_id: postId, parent_id: parent, author_id: user.id, body: text, hidden: check.hold }).select("id").single();
  if (error || !data) return { error: "Couldn't comment. Try again." };
  await check.record(data.id);
  if (!check.hold) {
    const name = user.name || "Someone";
    const replyTo = [
      ...(parentAuthor ? [{ userId: parentAuthor, title: `${name} replied to your comment` }] : []),
      ...(post.author_id ? [{ userId: post.author_id, title: `${name} replied to your post` }] : []),
    ];
    after(() => notifyCampus(db, { from: user.id, fromName: name, postId, text, replyTo }));
  }
  return { comments: await campusComments(postId, viewer), held: check.hold };
}

export async function deleteCampusComment(id: string): Promise<Result> {
  const { user, viewer, db } = await member();
  const { data: c } = await db.from("campus_comments").select("author_id").eq("id", id).maybeSingle();
  if (!c || (c.author_id !== user.id && !viewer.staff)) return { error: "You can't delete this comment." };
  await db.from("campus_comments").delete().eq("id", id);
  return { ok: "Comment deleted." };
}

export async function loadCampusComments(postId: string) {
  const { viewer } = await member();
  return campusComments(postId, viewer);
}

export async function loadMoreCampus(q: FeedQuery) {
  const { viewer } = await member();
  return campusFeed(viewer, { ...q, sort: "latest" });
}

// @mention suggestions while typing.
export async function findCampusPeople(term: string) {
  const { db } = await member();
  const q = term.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 30);
  if (!q) return [];
  // Username starting with what's typed, or any word of their name (so "@bukola" finds Oluwabukola Odunsi).
  const name = q.replace(/[._]/g, " ").trim();
  const { data } = await db
    .from("profiles")
    .select("username, full_name, avatar_url")
    .eq("status", "active")
    .not("username", "is", null)
    .or(`username.ilike.${q}%,full_name.ilike.%${name}%`)
    .limit(12);
  // Exact and starts-with usernames first, then name matches.
  const rank = (u: string, n: string) => (u === q ? 0 : u.startsWith(q) ? 1 : n.toLowerCase().startsWith(name) ? 2 : 3);
  return (data ?? [])
    .map((p) => ({ username: p.username!, name: p.full_name || p.username!, avatar: p.avatar_url }))
    .sort((a, b) => rank(a.username, a.name) - rank(b.username, b.name))
    .slice(0, 6);
}

// The little profile shown when hovering over someone's name.
export async function campusProfileCard(id: string) {
  const { db } = await member();
  if (!UUID.test(id)) return null;
  const [{ data: p }, { count: posts }, { data: roles }] = await Promise.all([
    db.from("profiles").select("full_name, username, avatar_url, headline, bio, location, created_at, profile_public").eq("id", id).maybeSingle(),
    db.from("campus_posts").select("id", { count: "exact", head: true }).eq("author_id", id).eq("hidden", false).is("repost_of", null),
    db.from("user_roles").select("role").eq("user_id", id),
  ]);
  if (!p) return null;
  const rs = (roles ?? []).map((r) => r.role as string);
  return {
    name: p.full_name || p.username || "Etivio learner",
    username: p.username,
    avatar: p.avatar_url,
    headline: p.headline,
    bio: p.profile_public ? (p.bio?.slice(0, 200) ?? null) : null,
    location: p.profile_public ? p.location : null,
    joined: p.created_at,
    posts: posts ?? 0,
    badge: rs.includes("super_admin") ? "Etivio team" : rs.includes("tutor") ? "Tutor" : rs.includes("coach") ? "Coach" : null,
  };
}
export type ProfileCard = NonNullable<Awaited<ReturnType<typeof campusProfileCard>>>;
