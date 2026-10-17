import Link from "next/link";
import { Plus } from "lucide-react";
import { Cover, Empty, PageHead, Status } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { createPost } from "./actions";

export const metadata = { title: "Blog" };

export default async function AdminBlog({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { db } = await requireAdmin();
  const { status } = await searchParams;
  const filter = status === "published" || status === "draft" ? status : undefined;

  let q = db
    .from("blog_posts")
    .select("id, title, slug, cover_url, status, tags, published_at, updated_at, author:profiles!blog_posts_author_id_fkey(full_name)")
    .order("updated_at", { ascending: false });
  if (filter) q = q.eq("status", filter);
  const { data: posts } = await q;

  return (
    <div className="et-page">
      <PageHead title="Blog" sub="Articles for the public Etivio blog.">
        <form action={createPost}>
          <button type="submit" className="et-btn et-btn-primary">
            <Plus size={15} />
            New post
          </button>
        </form>
      </PageHead>
      <section className="et-card">
        <div className="et-filters">
          <div className="et-tabs">
            <Link href="/admin/blog" className={!filter ? "is-on" : ""}>
              All
            </Link>
            <Link href="/admin/blog?status=published" className={filter === "published" ? "is-on" : ""}>
              Published
            </Link>
            <Link href="/admin/blog?status=draft" className={filter === "draft" ? "is-on" : ""}>
              Drafts
            </Link>
          </div>
        </div>
        {posts?.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Status</th>
                  <th>Tags</th>
                  <th>Published</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/blog/${p.id}`} className="et-cell-main">
                        <Cover url={p.cover_url} small />
                        <span>
                          <b>{p.title}</b>
                          <small>{p.author?.full_name || "No author"} · /blog/{p.slug}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Status value={p.status} />
                    </td>
                    <td>
                      <span className="et-inline">
                        {p.tags.map((t) => (
                          <span key={t} className="et-tag">
                            {t}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td>{p.published_at ? formatDate(p.published_at) : ""}</td>
                    <td>{formatDate(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No posts yet">
            <p>Write your first article for the Etivio blog.</p>
          </Empty>
        )}
      </section>
    </div>
  );
}
