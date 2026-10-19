"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Clock, Eye, Heart, MessageSquare } from "lucide-react";
import { Cover, StatStrip } from "@/components/dash/ui";
import { fmtSeconds, fmtShort, type PostStatus } from "@/lib/blog";

type Row = { id: string; title: string; cover: string | null; live: PostStatus; date: string | null; views: number; likes: number; comments: number; pending: number; avgRead: number | null };
type Key = "views" | "likes" | "comments" | "avgRead" | "date";
const LABEL: Record<PostStatus, string> = { published: "Published", scheduled: "Scheduled", draft: "Draft" };

export function MetricsClient({ rows }: { rows: Row[] }) {
  const [sort, setSort] = useState<Key>("views");
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  const sorted = useMemo(() => {
    const val = (r: Row) => (sort === "date" ? (r.date ? Date.parse(r.date) : 0) : (r[sort] ?? -1));
    return [...rows].sort((a, b) => (dir === "desc" ? val(b) - val(a) : val(a) - val(b)));
  }, [rows, sort, dir]);

  const total = (k: "views" | "likes" | "comments" | "pending") => rows.reduce((n, r) => n + r[k], 0);
  const timed = rows.filter((r) => r.avgRead);
  const avgRead = timed.length ? Math.round(timed.reduce((n, r) => n + (r.avgRead ?? 0), 0) / timed.length) : null;
  const pending = total("pending");

  function by(k: Key) {
    if (sort === k) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(k);
      setDir("desc");
    }
  }
  return (
    <>
      <div className="et-page-head">
        <div>
          <h1>Post metrics</h1>
          <p>How each post is doing with readers.</p>
        </div>
      </div>

      <StatStrip
        items={[
          { label: "Total views", value: total("views").toLocaleString(), icon: Eye },
          { label: "Total likes", value: total("likes").toLocaleString(), icon: Heart },
          { label: "Comments", value: total("comments").toLocaleString(), icon: MessageSquare, href: "/admin/blog/comments", hint: pending ? `${pending} waiting for review` : undefined },
          { label: "Average read time", value: fmtSeconds(avgRead), icon: Clock },
        ]}
      />

      {pending > 0 && (
        <Link href="/admin/blog/comments?filter=pending" className="et-blog-alert">
          <MessageSquare size={15} />
          {pending} {pending === 1 ? "comment is" : "comments are"} waiting for review
          <b>Review now</b>
        </Link>
      )}

      <section className="et-card">
        {rows.length === 0 ? (
          <p className="et-empty">No posts yet.</p>
        ) : (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <SortHead sort={sort} dir={dir} onSort={by} k="views">Views</SortHead>
                  <SortHead sort={sort} dir={dir} onSort={by} k="likes">Likes</SortHead>
                  <SortHead sort={sort} dir={dir} onSort={by} k="comments">Comments</SortHead>
                  <SortHead sort={sort} dir={dir} onSort={by} k="avgRead">Avg. read</SortHead>
                  <SortHead sort={sort} dir={dir} onSort={by} k="date">Published</SortHead>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/admin/blog/${r.id}`} className="et-cell-main">
                        <Cover url={r.cover} small />
                        <span>
                          <b>{r.title}</b>
                          <small>{LABEL[r.live]}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <b>{r.views.toLocaleString()}</b>
                    </td>
                    <td>{r.likes}</td>
                    <td>
                      {r.comments}
                      {r.pending > 0 && <b className="et-blog-pending"> +{r.pending}</b>}
                    </td>
                    <td>{r.avgRead ? fmtSeconds(r.avgRead) : "No data"}</td>
                    <td className="et-nowrap">{r.date ? fmtShort(r.date) : "Not yet"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function SortHead({ k, sort, dir, onSort, children }: { k: Key; sort: Key; dir: "desc" | "asc"; onSort: (k: Key) => void; children: React.ReactNode }) {
  return (
    <th aria-sort={sort === k ? (dir === "desc" ? "descending" : "ascending") : "none"}>
      <button type="button" className={`et-sort${sort === k ? " is-on" : ""}`} onClick={() => onSort(k)}>
        {children}
        {sort !== k ? <ArrowUpDown size={12} /> : dir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
      </button>
    </th>
  );
}
