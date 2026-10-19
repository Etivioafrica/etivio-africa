"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, PenLine, Search, Send, CalendarClock } from "lucide-react";
import { StatStrip } from "@/components/dash/ui";
import { fmtShort, type PostStatus } from "@/lib/blog";

type Post = { id: string; title: string; slug: string; excerpt: string | null; live: PostStatus; published_at: string | null; created_at: string };
const LABEL: Record<PostStatus, string> = { published: "Published", scheduled: "Scheduled", draft: "Draft" };

// Every post grouped by month, newest first.
export function ArchivesClient({ posts }: { posts: Post[] }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const shown = posts.filter((p) => !q || p.title.toLowerCase().includes(q));
  const months = new Map<string, Post[]>();
  for (const p of shown) {
    const key = new Date(p.published_at ?? p.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    months.set(key, [...(months.get(key) ?? []), p]);
  }
  const count = (s: PostStatus) => posts.filter((p) => p.live === s).length;

  return (
    <>
      <div className="et-page-head">
        <div>
          <h1>Archives</h1>
          <p>Every post, month by month.</p>
        </div>
        <label className="et-blog-search">
          <Search size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search archives…" aria-label="Search archives" />
        </label>
      </div>

      <StatStrip
        items={[
          { label: "Total posts", value: posts.length, icon: FileText },
          { label: "Published", value: count("published"), icon: Send },
          { label: "Scheduled", value: count("scheduled"), icon: CalendarClock },
          { label: "Drafts", value: count("draft"), icon: PenLine },
        ]}
      />

      {months.size === 0 ? (
        <section className="et-card">
          <p className="et-empty">{q ? "No posts match that search." : "No posts yet."}</p>
        </section>
      ) : (
        [...months].map(([month, list]) => (
          <section key={month} className="et-archive">
            <h2>
              {month}
              <span />
              <small>
                {list.length} {list.length === 1 ? "post" : "posts"}
              </small>
            </h2>
            <ul className="et-card">
              {list.map((p) => (
                <li key={p.id}>
                  <div>
                    <p>
                      <b>{p.title}</b>
                      <span className={`et-blog-status is-${p.live} is-static`}>
                        <i />
                        {LABEL[p.live]}
                      </span>
                    </p>
                    {p.excerpt && <small className="et-archive-excerpt">{p.excerpt}</small>}
                    <small>{fmtShort(p.published_at ?? p.created_at)}</small>
                  </div>
                  <span className="et-row-actions">
                    {p.live === "published" && (
                      <Link href={`/blog/${p.slug}`} target="_blank" aria-label="View on site" data-tip="View on site">
                        <ExternalLink size={14} />
                      </Link>
                    )}
                    <Link href={`/admin/blog/${p.id}`} aria-label="Edit" data-tip="Edit">
                      <PenLine size={14} />
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
