"use server";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { deleteObject, keyFromUrl } from "@/lib/r2";
import { slugify } from "@/lib/format";
import { sanitizeRichText } from "@/lib/sanitize";
import { fetchLinkMeta, type LinkMeta } from "@/lib/link-meta";
import type { PostStatus } from "@/lib/blog";

type Result = { error?: string; ok?: string; id?: string };

export type PostInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl: string;
  status: PostStatus;
  scheduledAt: string;
  metaTitle: string;
  metaDesc: string;
  keyword: string;
  authorId: string;
  categoryIds: string[];
};

// Turns a status choice into the columns that drive it. Scheduled posts go live on their own at `published_at`.
function statusColumns(status: PostStatus, scheduledAt: string | null, publishedBefore: string | null): { status: PostStatus; published_at: string | null } {
  if (status === "published") return { status, published_at: publishedBefore && Date.parse(publishedBefore) <= Date.now() ? publishedBefore : new Date().toISOString() };
  if (status === "scheduled") return { status, published_at: scheduledAt };
  return { status, published_at: null };
}

function validSchedule(status: PostStatus, at: string) {
  if (status !== "scheduled") return null;
  const t = Date.parse(at);
  if (!at || Number.isNaN(t)) return { error: "Pick a date and time to publish." };
  if (t <= Date.now()) return { error: "The scheduled time has to be in the future." };
  return null;
}

export async function savePost(input: PostInput): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  const title = input.title.trim().slice(0, 200);
  const slug = slugify(input.slug || title);
  if (title.length < 3) return { error: "Give the post a title (3 characters or more)." };
  if (!slug) return { error: "Add a URL slug." };
  const bad = validSchedule(input.status, input.scheduledAt);
  if (bad) return bad;
  const scheduledAt = input.status === "scheduled" ? new Date(input.scheduledAt).toISOString() : null;

  const before = input.id ? (await db.from("blog_posts").select("cover_url, published_at, status").eq("id", input.id).maybeSingle()).data : null;
  if (input.id && !before) return { error: "That post no longer exists." };

  const row = {
    title,
    slug,
    excerpt: input.excerpt.trim().slice(0, 400) || null,
    content: sanitizeRichText(input.content),
    cover_url: input.coverUrl || null,
    meta_title: input.metaTitle.trim().slice(0, 120) || null,
    meta_description: input.metaDesc.trim().slice(0, 320) || null,
    focus_keyword: input.keyword.trim().slice(0, 80) || null,
    author_id: input.authorId || admin.id,
    ...statusColumns(input.status, scheduledAt, before?.published_at ?? null),
  };

  const saved = input.id
    ? await db.from("blog_posts").update(row).eq("id", input.id).select("id").single()
    : await db.from("blog_posts").insert(row).select("id").single();
  if (saved.error || !saved.data) return { error: saved.error?.code === "23505" ? "That URL slug is already used by another post." : "Could not save the post." };
  const id = saved.data.id;

  const categoryIds = [...new Set(input.categoryIds)].slice(0, 20);
  await db.from("blog_post_categories").delete().eq("post_id", id);
  if (categoryIds.length) await db.from("blog_post_categories").insert(categoryIds.map((category_id) => ({ post_id: id, category_id })));

  if (before?.cover_url && before.cover_url !== row.cover_url) await deleteObject(keyFromUrl(before.cover_url));
  if (!input.id) await audit(admin.id, "blog.create", { type: "post", id });
  if (before?.status !== input.status) await audit(admin.id, `blog.${input.status}`, { type: "post", id });
  refresh();
  return { ok: "Saved.", id };
}

export async function setPostStatus(id: string, status: PostStatus, scheduledAt = ""): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  const bad = validSchedule(status, scheduledAt);
  if (bad) return bad;
  const { data: before } = await db.from("blog_posts").select("published_at").eq("id", id).maybeSingle();
  if (!before) return { error: "That post no longer exists." };
  const cols = statusColumns(status, status === "scheduled" ? new Date(scheduledAt).toISOString() : null, before.published_at);
  const { error } = await db
    .from("blog_posts")
    .update({ ...cols, ...(status === "draft" ? { featured: false } : {}) })
    .eq("id", id);
  if (error) return { error: "Could not change the status." };
  await audit(admin.id, `blog.${status}`, { type: "post", id });
  refresh();
  return { ok: "Updated." };
}

// One featured post at most. Passing null clears it.
export async function setFeatured(id: string | null): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  await db.from("blog_posts").update({ featured: false }).eq("featured", true);
  if (id) {
    const { error } = await db.from("blog_posts").update({ featured: true }).eq("id", id);
    if (error) return { error: "Could not feature that post." };
  }
  await audit(admin.id, id ? "blog.feature" : "blog.unfeature", id ? { type: "post", id } : undefined);
  refresh();
  return { ok: id ? "Featured." : "Removed from featured." };
}

export async function deletePost(id: string): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  const { data } = await db.from("blog_posts").select("cover_url, title").eq("id", id).maybeSingle();
  if (!data) return { error: "That post no longer exists." };
  await db.from("blog_posts").delete().eq("id", id);
  await deleteObject(keyFromUrl(data.cover_url));
  await audit(admin.id, "blog.delete", { type: "post", id }, { title: data.title });
  refresh();
  return { ok: "Deleted." };
}

// Categories ------------------------------------------------------------------------

export async function addCategory(name: string, parentId: string | null): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  const clean = name.trim().slice(0, 60);
  if (!clean) return { error: "Type a name first." };
  const base = slugify(clean) || "category";
  const { data: taken } = await db.from("blog_categories").select("slug").like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((t) => t.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
  const { data, error } = await db.from("blog_categories").insert({ name: clean, slug, parent_id: parentId }).select("id").single();
  if (error || !data) return { error: "Could not add the category." };
  await audit(admin.id, "blog.category_add", { type: "blog_category", id: data.id }, { name: clean });
  refresh();
  return { ok: "Added.", id: data.id };
}

export async function deleteCategory(id: string): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  await db.from("blog_categories").delete().eq("id", id);
  await audit(admin.id, "blog.category_delete", { type: "blog_category", id });
  refresh();
  return { ok: "Deleted." };
}

// Comments --------------------------------------------------------------------------

export async function approveComment(id: string, approved: boolean): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  const { error } = await db.from("blog_comments").update({ approved }).eq("id", id);
  if (error) return { error: "Could not update the comment." };
  await audit(admin.id, approved ? "blog.comment_approve" : "blog.comment_unapprove", { type: "blog_comment", id });
  refresh();
  return { ok: approved ? "Approved." : "Hidden." };
}

export async function replyToComment(id: string, reply: string): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  const text = reply.trim().slice(0, 2000);
  // Replying also approves, so the answer shows up under the comment.
  const { error } = await db
    .from("blog_comments")
    .update(text ? { admin_reply: text, replied_at: new Date().toISOString(), approved: true } : { admin_reply: null, replied_at: null })
    .eq("id", id);
  if (error) return { error: "Could not save the reply." };
  await audit(admin.id, text ? "blog.comment_reply" : "blog.comment_reply_remove", { type: "blog_comment", id });
  refresh();
  return { ok: text ? "Reply posted." : "Reply removed." };
}

export async function deleteComment(id: string): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  await db.from("blog_comments").delete().eq("id", id);
  await audit(admin.id, "blog.comment_delete", { type: "blog_comment", id });
  refresh();
  return { ok: "Deleted." };
}

// Curated links -----------------------------------------------------------------------

export async function fetchCuratedMeta(url: string): Promise<LinkMeta & { error?: string }> {
  await requireAdmin("blog");
  return fetchLinkMeta(url);
}

export async function saveCurated(input: { url: string; sourceName: string; title: string; excerpt: string; coverUrl: string }): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  let url: URL;
  try {
    url = new URL(input.url.trim());
  } catch {
    return { error: "That link doesn't look right." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "Use a normal web link (https://…)." };
  const cover = input.coverUrl.trim();
  if (cover && !/^https?:\/\//.test(cover)) return { error: "The image link must start with https://" };
  if (!input.title.trim()) return { error: "Add a title." };
  const { data, error } = await db
    .from("blog_curated")
    .insert({
      url: url.toString(),
      source_name: input.sourceName.trim().slice(0, 80) || url.hostname.replace(/^www\./, ""),
      title: input.title.trim().slice(0, 300),
      excerpt: input.excerpt.trim().slice(0, 600) || null,
      cover_url: cover.slice(0, 2000) || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not save the link." };
  await audit(admin.id, "blog.curated_add", { type: "blog_curated", id: data.id });
  refresh();
  return { ok: "Saved.", id: data.id };
}

export async function toggleCurated(id: string, published: boolean): Promise<Result> {
  const { db } = await requireAdmin("blog");
  await db.from("blog_curated").update({ published }).eq("id", id);
  refresh();
  return { ok: published ? "Showing." : "Hidden." };
}

export async function deleteCurated(id: string): Promise<Result> {
  const { admin, db } = await requireAdmin("blog");
  await db.from("blog_curated").delete().eq("id", id);
  await audit(admin.id, "blog.curated_delete", { type: "blog_curated", id });
  refresh();
  return { ok: "Deleted." };
}
