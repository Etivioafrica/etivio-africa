import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PostStatus } from "@/lib/blog";

export type Category = { id: string; name: string; slug: string; parent_id: string | null };
export type PostCat = { post_id: string; category_id: string };
export type Metrics = { views: number; likes: number; comments: number; pending: number; avgRead: number | null };

const LIST_COLS = "id, title, slug, excerpt, cover_url, status, featured, published_at, created_at, updated_at, author:profiles!blog_posts_author_id_fkey(full_name)";

// Everything the admin posts list needs in one go.
export async function getAdminBlog() {
  const db = createAdminClient();
  const [posts, categories, postCats, metrics] = await Promise.all([
    db.from("blog_posts").select(LIST_COLS).order("created_at", { ascending: false }),
    db.from("blog_categories").select("id, name, slug, parent_id").order("name"),
    db.from("blog_post_categories").select("post_id, category_id"),
    db.rpc("blog_post_metrics"),
  ]);
  const byPost: Record<string, Metrics> = {};
  for (const m of metrics.data ?? []) byPost[m.post_id] = { views: m.views, likes: m.likes, comments: m.comments, pending: m.pending, avgRead: m.avg_read };
  return {
    posts: (posts.data ?? []).map((p) => ({ ...p, status: p.status as PostStatus, author: p.author?.full_name ?? null })),
    categories: (categories.data ?? []) as Category[],
    postCats: (postCats.data ?? []) as PostCat[],
    metrics: byPost,
  };
}

export type AdminPost = Awaited<ReturnType<typeof getAdminBlog>>["posts"][number];

export async function getCategories() {
  const { data } = await createAdminClient().from("blog_categories").select("id, name, slug, parent_id").order("name");
  return (data ?? []) as Category[];
}

export async function pendingCommentCount() {
  const { count } = await createAdminClient().from("blog_comments").select("id", { count: "exact", head: true }).eq("approved", false);
  return count ?? 0;
}

// Public blog --------------------------------------------------------------------------

const PUBLIC_COLS = "id, title, slug, excerpt, cover_url, content, featured, published_at, author:profiles!blog_posts_author_id_fkey(full_name, avatar_url)";

// Published posts plus scheduled ones whose time has come.
const live = <T extends { neq: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(q: T) =>
  q.neq("status", "draft").lte("published_at", new Date().toISOString());

export async function getPublicBlog() {
  "use cache";
  // Pulls every post body (for read times), so cache it for up to an hour; admin blog changes clear the "blog" tag at
  // once, and the cache ends early when the next scheduled post is due, so it appears on time.
  cacheTag("blog");
  const db = createAdminClient();
  const now = new Date().toISOString();
  const [posts, categories, postCats, curated, next] = await Promise.all([
    live(db.from("blog_posts").select(PUBLIC_COLS)).order("published_at", { ascending: false }).limit(500),
    db.from("blog_categories").select("id, name, slug, parent_id").order("created_at"),
    db.from("blog_post_categories").select("post_id, category_id"),
    db.from("blog_curated").select("id, url, source_name, title, excerpt, cover_url, created_at").eq("published", true).order("created_at", { ascending: false }).limit(120),
    db.from("blog_posts").select("published_at").neq("status", "draft").gt("published_at", now).order("published_at").limit(1).maybeSingle(),
  ]);
  const dueIn = next.data?.published_at ? Math.ceil((Date.parse(next.data.published_at) - Date.now()) / 1000) : Infinity;
  const revalidate = Math.min(3600, Math.max(30, dueIn));
  cacheLife({ stale: Math.min(60, revalidate), revalidate, expire: Math.max(revalidate, 86400) });
  return {
    posts: posts.data ?? [],
    categories: (categories.data ?? []) as Category[],
    postCats: (postCats.data ?? []) as PostCat[],
    curated: curated.data ?? [],
  };
}

export type PublicPost = Awaited<ReturnType<typeof getPublicBlog>>["posts"][number];
export type CuratedLink = Awaited<ReturnType<typeof getPublicBlog>>["curated"][number];

export async function getPublicPost(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("blog");
  const db = createAdminClient();
  const { data: post } = await live(
    db.from("blog_posts").select(`${PUBLIC_COLS}, meta_title, meta_description, updated_at`).eq("slug", slug),
  ).maybeSingle();
  if (!post) return null;
  const [latest, cats, comments, likes] = await Promise.all([
    live(db.from("blog_posts").select("id, title, slug, cover_url, published_at")).neq("id", post.id).order("published_at", { ascending: false }).limit(4),
    db.from("blog_post_categories").select("category:blog_categories(name, slug)").eq("post_id", post.id),
    db.from("blog_comments").select("id, author_name, content, admin_reply, replied_at, created_at").eq("post_id", post.id).eq("approved", true).order("created_at"),
    db.from("blog_likes").select("post_id", { count: "exact", head: true }).eq("post_id", post.id),
  ]);
  return {
    post,
    latest: latest.data ?? [],
    categories: (cats.data ?? []).map((c) => c.category).filter((c): c is { name: string; slug: string } => !!c),
    comments: comments.data ?? [],
    likes: likes.count ?? 0,
  };
}

export type PublicComment = NonNullable<Awaited<ReturnType<typeof getPublicPost>>>["comments"][number];
