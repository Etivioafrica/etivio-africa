import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { Status } from "@/components/dash/ui";
import { ActionForm } from "@/components/dash/ActionForm";
import { Uploader } from "@/components/dash/Uploader";
import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { usersWithRoles } from "@/lib/data/admin";
import { deletePost, savePost } from "../actions";

export const metadata = { title: "Edit post" };

export default async function PostEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin("blog");
  const [{ data: post }, authors] = await Promise.all([
    db.from("blog_posts").select("*").eq("id", id).maybeSingle(),
    usersWithRoles(db, ["super_admin", "editor", "tutor"]),
  ]);
  if (!post) notFound();
  const live = post.status === "published";

  return (
    <div className="et-page">
      <Link href="/admin/blog" className="et-back">
        <ArrowLeft size={14} />
        Blog
      </Link>
      <div className="et-page-head">
        <div>
          <h1>
            {post.title} <Status value={post.status} />
          </h1>
          <p>{live ? `Published ${formatDate(post.published_at)}` : `Last edited ${formatDate(post.updated_at)}`}</p>
        </div>
        {live && (
          <Link href={`/blog/${post.slug}`} className="et-btn et-btn-ghost" target="_blank">
            <ExternalLink size={15} />
            View live
          </Link>
        )}
      </div>

      <ActionForm action={savePost} className="et-form">
        <input type="hidden" name="id" value={post.id} />
        <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
          <section className="et-card et-card-pad et-form">
            <div className="et-field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" defaultValue={post.title} required style={{ fontSize: 16, fontWeight: 600 }} />
            </div>
            <div className="et-field">
              <label htmlFor="excerpt">Excerpt</label>
              <textarea id="excerpt" name="excerpt" rows={2} defaultValue={post.excerpt ?? ""} placeholder="Shown on the blog index and in search results" />
            </div>
            <div className="et-field">
              <label htmlFor="content">Article</label>
              <textarea id="content" name="content" rows={22} defaultValue={post.content ?? ""} placeholder={"Write the article. Blank lines start new paragraphs.\n\n## Headings start with two hashes"} />
              <small>Plain text. Blank lines split paragraphs; lines starting with ## become headings.</small>
            </div>
          </section>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="et-card et-card-pad et-form">
              <div className="et-field">
                <label>Cover image</label>
                <Uploader name="cover_url" kind="blog" defaultUrl={post.cover_url} label="Upload a cover image" />
              </div>
              <div className="et-field">
                <label htmlFor="slug">URL slug</label>
                <input id="slug" name="slug" defaultValue={post.slug} required />
              </div>
              <div className="et-field">
                <label htmlFor="tags">Tags</label>
                <input id="tags" name="tags" defaultValue={post.tags.join(", ")} placeholder="careers, design, news" />
              </div>
              <div className="et-field">
                <label htmlFor="author_id">Author</label>
                <select id="author_id" name="author_id" defaultValue={post.author_id ?? ""}>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>
            <section className="et-card et-card-pad" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button type="submit" name="intent" value="save" className="et-btn et-btn-ghost">
                Save {live ? "changes" : "draft"}
              </button>
              {live ? (
                <button type="submit" name="intent" value="unpublish" className="et-btn et-btn-ghost">
                  Unpublish
                </button>
              ) : (
                <button type="submit" name="intent" value="publish" className="et-btn et-btn-primary">
                  Publish
                </button>
              )}
            </section>
          </div>
        </div>
      </ActionForm>

      <section className="et-card et-card-pad" style={{ display: "flex", justifyContent: "flex-end" }}>
        <form action={deletePost}>
          <input type="hidden" name="id" value={post.id} />
          <button type="submit" className="et-btn et-btn-sm et-btn-danger-text">
            <Trash2 size={14} />
            Delete post
          </button>
        </form>
      </section>
    </div>
  );
}
