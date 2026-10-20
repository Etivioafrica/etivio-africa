import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/email/site";

const STATIC = ["", "/explore", "/about", "/tutors", "/blog", "/help", "/contact", "/teach-on-etivio", "/certificate", "/privacy", "/terms", "/refund-policy"];

// Every public page: the fixed ones plus live courses, products, blog posts and public profiles.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const db = createAdminClient();
  const base = siteUrl();
  const [{ data: courses }, { data: products }, { data: posts }, { data: people }] = await Promise.all([
    db.from("courses").select("slug, updated_at").eq("status", "published"),
    db.from("products").select("slug, updated_at").eq("status", "published"),
    db.from("blog_posts").select("slug, updated_at").neq("status", "draft").lte("published_at", new Date().toISOString()),
    db.from("profiles").select("username, updated_at").eq("profile_public", true).eq("status", "active").is("deleted_at", null).not("username", "is", null),
  ]);
  return [
    ...STATIC.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...(courses ?? []).map((c) => ({ url: `${base}/courses/${c.slug}`, lastModified: c.updated_at, priority: 0.8 })),
    ...(products ?? []).map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updated_at, priority: 0.8 })),
    ...(posts ?? []).map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updated_at, priority: 0.5 })),
    ...(people ?? []).map((p) => ({ url: `${base}/@${p.username}`, lastModified: p.updated_at, priority: 0.3 })),
  ];
}
