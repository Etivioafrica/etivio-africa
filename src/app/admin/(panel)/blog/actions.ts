"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { deleteObject, keyFromUrl } from "@/lib/r2";
import { slugify } from "@/lib/format";
import type { FormState } from "@/app/(app)/teach/actions";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function createPost() {
  const { admin, db } = await requireAdmin("blog");
  const slug = `untitled-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await db.from("blog_posts").insert({ title: "Untitled post", slug, author_id: admin.id }).select("id").single();
  if (error || !data) throw new Error("Could not create the post.");
  await audit(admin.id, "blog.create", { type: "post", id: data.id });
  redirect(`/admin/blog/${data.id}`);
}

export async function savePost(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("blog");
  const id = str(fd, "id");
  const title = str(fd, "title");
  const slug = slugify(str(fd, "slug") || title);
  if (title.length < 3) return { error: "Title needs at least 3 characters." };
  if (!slug) return { error: "Add a URL slug." };
  const publish = str(fd, "intent") === "publish";
  const unpublish = str(fd, "intent") === "unpublish";
  const cover = str(fd, "cover_url") || null;
  const tags = str(fd, "tags")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);

  const { data: before } = await db.from("blog_posts").select("cover_url, status, published_at").eq("id", id).single();
  const { error } = await db
    .from("blog_posts")
    .update({
      title,
      slug,
      excerpt: str(fd, "excerpt") || null,
      content: str(fd, "content") || null,
      cover_url: cover,
      tags,
      author_id: str(fd, "author_id") || undefined,
      ...(publish ? { status: "published" as const, published_at: before?.published_at ?? new Date().toISOString() } : {}),
      ...(unpublish ? { status: "draft" as const } : {}),
    })
    .eq("id", id);
  if (error) return { error: error.code === "23505" ? "That URL slug is taken." : "Could not save the post." };
  if (before?.cover_url && before.cover_url !== cover) await deleteObject(keyFromUrl(before.cover_url));
  if (publish || unpublish) await audit(admin.id, publish ? "blog.publish" : "blog.unpublish", { type: "post", id });
  refresh();
  return { ok: publish ? "Published." : unpublish ? "Moved back to draft." : "Saved." };
}

export async function deletePost(fd: FormData) {
  const { admin, db } = await requireAdmin("blog");
  const id = str(fd, "id");
  const { data } = await db.from("blog_posts").select("cover_url, title").eq("id", id).single();
  await db.from("blog_posts").delete().eq("id", id);
  await deleteObject(keyFromUrl(data?.cover_url ?? null));
  await audit(admin.id, "blog.delete", { type: "post", id }, { title: data?.title ?? "" });
  redirect("/admin/blog");
}
