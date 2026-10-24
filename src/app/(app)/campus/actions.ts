"use server";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObject, keyFromUrl } from "@/lib/r2";
import { isStaff } from "@/lib/roles";
import { moderate } from "@/lib/moderation";
import { CAMPUS_KINDS, campusComments, campusFeed, campusOn, type CampusKind, type FeedQuery } from "@/lib/data/campus";

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

// #hashtags in a post, lowercased, at most 10.
const tagsIn = (text: string) => [...new Set([...text.matchAll(/(?:^|[^\w&])#([a-z0-9_]{2,30})/gi)].map((m) => m[1].toLowerCase()))].slice(0, 10);

export type NewPost = {
  kind: CampusKind;
  body: string;
  imageUrl?: string;
  videoUrl?: string;
  quotedId?: string;
  poll?: { options: string[]; multiple: boolean; days: number };
};

export async function createCampusPost(input: NewPost): Promise<Result & { id?: string }> {
  const { user, db } = await member();
  const kind = CAMPUS_KINDS.some((k) => k.value === input.kind) ? input.kind : "update";
  const body = String(input.body ?? "").trim().slice(0, 5000);
  const image = input.imageUrl && keyFromUrl(input.imageUrl)?.startsWith("posts/") ? input.imageUrl : null;
  const video = input.videoUrl?.trim() || null;
  if (video && !YOUTUBE.test(video)) return { error: "Videos are YouTube links (youtube.com or youtu.be)." };
  const quotedId = input.quotedId && UUID.test(input.quotedId) ? input.quotedId : null;
  const options = kind === "poll" ? (input.poll?.options ?? []).map((o) => String(o).trim().slice(0, 80)).filter(Boolean) : [];
  if (kind === "poll" && (options.length < 2 || options.length > 4)) return { error: "A poll needs 2 to 4 options." };
  if (kind === "poll" && !body) return { error: "Ask the poll question." };
  if (!body && !image && !video && !quotedId) return { error: "Write something first." };

  const { count } = await db.from("campus_posts").select("id", { count: "exact", head: true }).eq("author_id", user.id).gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= HOURLY_POSTS) return { error: "You've posted a lot in the last hour. Take a break and try again later." };
  if (quotedId) {
    const { data: q } = await db.from("campus_posts").select("id, hidden").eq("id", quotedId).maybeSingle();
    if (!q || q.hidden) return { error: "The post you're quoting is no longer there." };
  }

  const check = await moderate("campus_post", user.id, [body, ...options]);
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
      hashtags: tagsIn(body),
      poll_multiple: kind === "poll" && !!input.poll?.multiple,
      poll_ends_at: kind === "poll" ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
      hidden: check.hold,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't post. Try again." };
  if (options.length) await db.from("campus_poll_options").insert(options.map((label, position) => ({ post_id: data.id, position, label })));
  await check.record(data.id);
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
  if (parentId && UUID.test(parentId)) {
    const { data: p } = await db.from("campus_comments").select("id, parent_id").eq("id", parentId).eq("post_id", postId).maybeSingle();
    parent = p ? (p.parent_id ?? p.id) : null;
  }
  const check = await moderate("campus_comment", user.id, [text], `/campus/${postId}`);
  if (check.error) return { error: check.error };
  const { data, error } = await db.from("campus_comments").insert({ post_id: postId, parent_id: parent, author_id: user.id, body: text, hidden: check.hold }).select("id").single();
  if (error || !data) return { error: "Couldn't comment. Try again." };
  await check.record(data.id);
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
  const { data } = await db.from("profiles").select("username, full_name, avatar_url").eq("status", "active").not("username", "is", null).ilike("username", `${q}%`).limit(6);
  return (data ?? []).map((p) => ({ username: p.username!, name: p.full_name || p.username!, avatar: p.avatar_url }));
}
