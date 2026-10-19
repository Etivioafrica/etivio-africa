import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { PostStatus } from "@/lib/blog";
import { BlogEditor } from "../BlogEditor";
import { editorContext, toHtml } from "../editor-data";

export const metadata = { title: "Edit post" };

type Props = { params: Promise<{ id: string }> };

export default function EditPost({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 640 }} />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Props) {
  const { id } = await params;
  const { admin, db, categories, authors } = await editorContext();
  const [{ data: post }, { data: cats }] = await Promise.all([
    db.from("blog_posts").select("*").eq("id", id).maybeSingle(),
    db.from("blog_post_categories").select("category_id").eq("post_id", id),
  ]);
  if (!post) notFound();
  return (
    <BlogEditor
      key={post.id}
      categories={categories}
      authors={authors}
      initial={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? "",
        content: toHtml(post.content),
        coverUrl: post.cover_url ?? "",
        status: post.status as PostStatus,
        publishedAt: post.published_at,
        metaTitle: post.meta_title ?? "",
        metaDesc: post.meta_description ?? "",
        keyword: post.focus_keyword ?? "",
        authorId: post.author_id ?? admin.id,
        categoryIds: (cats ?? []).map((c) => c.category_id),
      }}
    />
  );
}
