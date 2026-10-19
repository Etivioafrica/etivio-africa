"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown, ExternalLink, Eye, Heart, MessageSquare, PenLine, Plus, Search, Star, Trash2, UploadCloud, X } from "lucide-react";
import { Cover } from "@/components/dash/ui";
import { useToast } from "@/components/dash/useToast";
import { fmtShort, liveStatus, type PostStatus } from "@/lib/blog";
import type { AdminPost, Category, Metrics, PostCat } from "@/lib/data/blog";
import { deletePost, setFeatured, setPostStatus } from "./actions";

type Filter = "all" | PostStatus;
const STATUS_LABEL: Record<PostStatus, string> = { published: "Published", scheduled: "Scheduled", draft: "Draft" };

// Local "YYYY-MM-DDTHH:mm" for datetime-local inputs.
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function BlogList({ posts, categories, postCats, metrics }: { posts: AdminPost[]; categories: Category[]; postCats: PostCat[]; metrics: Record<string, Metrics> }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, show] = useToast();
  const [pending, start] = useTransition();
  const [statusFor, setStatusFor] = useState<AdminPost | null>(null);
  const [deleteFor, setDeleteFor] = useState<AdminPost | null>(null);
  const statusDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);

  const status = (p: AdminPost) => liveStatus(p);
  const counts = { all: posts.length, published: 0, draft: 0, scheduled: 0 };
  for (const p of posts) counts[status(p)]++;

  const catMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const pc of postCats) (m[pc.post_id] ??= []).push(pc.category_id);
    return m;
  }, [postCats]);
  const parents = categories.filter((c) => !c.parent_id);
  const childIds = (id: string) => [id, ...categories.filter((c) => c.parent_id === id).map((c) => c.id)];

  const q = search.trim().toLowerCase();
  const shown = posts.filter(
    (p) =>
      (filter === "all" || status(p) === filter) &&
      (!q || p.title.toLowerCase().includes(q) || (p.excerpt ?? "").toLowerCase().includes(q)) &&
      (cat === "all" || (catMap[p.id] ?? []).some((c) => childIds(cat).includes(c))),
  );

  function run(fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) {
    start(async () => {
      const res = await fn();
      show(res);
      if (!res.error) after?.();
    });
  }

  function openStatus(p: AdminPost) {
    setStatusFor(p);
    statusDialog.current?.showModal();
  }

  function openDelete(p: AdminPost) {
    setDeleteFor(p);
    deleteDialog.current?.showModal();
  }

  return (
    <>
      {toast}
      <div className="et-page-head">
        <div>
          <h1>Blog posts</h1>
          <p>
            {posts.length} {posts.length === 1 ? "post" : "posts"} in total
          </p>
        </div>
        <Link href="/admin/blog/new" className="et-btn et-btn-primary">
          <Plus size={15} /> New post
        </Link>
      </div>

      <section className="et-card">
        <div className="et-blog-bar">
          <nav className="et-blog-filter" aria-label="Filter by status">
            {(["all", "published", "draft", "scheduled"] as Filter[]).map((f) => (
              <button key={f} type="button" className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)} aria-pressed={filter === f}>
                {f === "all" ? "All" : STATUS_LABEL[f]}
                <span>{counts[f]}</span>
              </button>
            ))}
          </nav>
          <div className="et-inline">
            {parents.length > 0 && (
              <select className="et-input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
                <option value="all">All categories</option>
                {parents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <label className="et-blog-search">
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search posts…" aria-label="Search posts" />
            </label>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="et-empty">
            {q ? `No posts matching "${search}".` : filter !== "all" ? `No ${STATUS_LABEL[filter].toLowerCase()} posts yet.` : "No posts yet. Write your first one."}
          </p>
        ) : (
          <div className="et-table-wrap">
            <table className="et-table et-blog-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Reach</th>
                  <th>Date</th>
                  <th className="et-td-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const s = status(p);
                  const m = metrics[p.id];
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/blog/${p.id}`} className="et-cell-main">
                          <Cover url={p.cover_url} small />
                          <span>
                            <b>{p.title}</b>
                            <small>{p.excerpt || `${p.author ?? "No author"} · /blog/${p.slug}`}</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <button type="button" className={`et-blog-status is-${s}`} onClick={() => openStatus(p)} title="Change status">
                          <i />
                          {STATUS_LABEL[s]}
                          <ChevronDown size={12} />
                        </button>
                      </td>
                      <td>
                        <span className="et-blog-reach">
                          <span title="Views">
                            <Eye size={13} /> {m?.views ?? 0}
                          </span>
                          <span title="Likes">
                            <Heart size={13} /> {m?.likes ?? 0}
                          </span>
                          <span title="Comments">
                            <MessageSquare size={13} /> {m?.comments ?? 0}
                            {!!m?.pending && <b>+{m.pending}</b>}
                          </span>
                        </span>
                      </td>
                      <td className="et-nowrap">{s === "scheduled" ? <>Goes live {fmtShort(p.published_at)}</> : fmtShort(p.published_at ?? p.created_at)}</td>
                      <td className="et-td-right">
                        <span className="et-row-actions">
                          <button
                            type="button"
                            className={p.featured ? "is-star" : ""}
                            onClick={() => run(() => setFeatured(p.featured ? null : p.id))}
                            disabled={pending || (s === "draft" && !p.featured)}
                            data-tip={p.featured ? "Remove from featured" : s === "draft" ? "Publish it first to feature it" : "Feature on the blog"}
                            aria-label={p.featured ? "Remove from featured" : "Feature on the blog"}
                          >
                            <Star size={14} fill={p.featured ? "currentColor" : "none"} />
                          </button>
                          {s === "published" && (
                            <Link href={`/blog/${p.slug}`} target="_blank" data-tip="View on site" aria-label="View on site">
                              <ExternalLink size={14} />
                            </Link>
                          )}
                          <Link href={`/admin/blog/${p.id}`} data-tip="Edit" aria-label="Edit">
                            <PenLine size={14} />
                          </Link>
                          <button type="button" className="is-danger" onClick={() => openDelete(p)} data-tip="Delete" aria-label="Delete">
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <StatusDialog
        ref={statusDialog}
        post={statusFor}
        pending={pending}
        onPick={(next, at) => statusFor && run(() => setPostStatus(statusFor.id, next, at), () => statusDialog.current?.close())}
      />

      <dialog ref={deleteDialog} className="et-modal et-modal-sm" aria-label="Delete post" onClick={(e) => e.target === deleteDialog.current && deleteDialog.current?.close()}>
        <div className="et-modal-head">
          <div className="et-blog-modal-title">
            <span className="et-blog-modal-icon is-danger">
              <Trash2 size={17} />
            </span>
            <div>
              <h2>Delete post</h2>
              <p>{deleteFor?.title}</p>
            </div>
          </div>
          <button type="button" className="et-icon-btn" onClick={() => deleteDialog.current?.close()} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="et-modal-body">
          <p className="et-flash et-flash-err">This deletes the post, its likes, comments and view history for good. It can&apos;t be undone.</p>
        </div>
        <div className="et-modal-foot">
          <button type="button" className="et-btn et-btn-ghost" onClick={() => deleteDialog.current?.close()}>
            Cancel
          </button>
          <button
            type="button"
            className="et-btn et-btn-danger"
            disabled={pending}
            onClick={() => deleteFor && run(() => deletePost(deleteFor.id), () => deleteDialog.current?.close())}
          >
            {pending ? "Deleting…" : "Delete post"}
          </button>
        </div>
      </dialog>
    </>
  );
}

// Anne's two-step status picker: choose Publish / Draft / Schedule, then confirm (or pick a time).
function StatusDialog({
  ref,
  post,
  pending,
  onPick,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  post: AdminPost | null;
  pending: boolean;
  onPick: (s: PostStatus, at?: string) => void;
}) {
  const [step, setStep] = useState<PostStatus | null>(null);
  const [at, setAt] = useState("");
  const current = post ? liveStatus(post) : "draft";
  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className="et-modal et-modal-sm"
      aria-label="Change status"
      onClose={() => {
        setStep(null);
        setAt("");
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="et-modal-head">
        <div>
          <h2>Change status</h2>
          <p>{post?.title}</p>
        </div>
        <button type="button" className="et-icon-btn" onClick={close} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="et-modal-body">
        {step === null ? (
          <div className="et-blog-choices">
            {current !== "published" && (
              <button type="button" className="is-published" onClick={() => setStep("published")}>
                <span>
                  <UploadCloud size={16} />
                </span>
                <b>Publish now</b>
                <small>Goes live on the blog straight away</small>
              </button>
            )}
            {current !== "draft" && (
              <button type="button" className="is-draft" onClick={() => setStep("draft")}>
                <span>
                  <PenLine size={16} />
                </span>
                <b>{current === "published" ? "Unpublish" : "Move to draft"}</b>
                <small>Saved privately, hidden from the site</small>
              </button>
            )}
            <button type="button" className="is-scheduled" onClick={() => setStep("scheduled")}>
              <span>
                <CalendarClock size={16} />
              </span>
              <b>{current === "scheduled" ? "Change schedule" : "Schedule"}</b>
              <small>Pick a future date and time</small>
            </button>
          </div>
        ) : step === "scheduled" ? (
          <div className="et-field">
            <label htmlFor="sched">Publish on</label>
            <input id="sched" type="datetime-local" className="et-input" value={at} min={localInput(new Date())} onChange={(e) => setAt(e.target.value)} />
            <small>Times are in your local time zone.</small>
          </div>
        ) : (
          <div className="et-blog-confirm">
            <b>{step === "published" ? "Publish this post?" : "Move this post to draft?"}</b>
            <p>{step === "published" ? "It goes live straight away and anyone can read it." : "It comes off the site and is kept privately. If it's featured, it stops being featured."}</p>
          </div>
        )}
      </div>
      {step !== null && (
        <div className="et-modal-foot">
          <button type="button" className="et-btn et-btn-ghost" onClick={() => setStep(null)} style={{ marginRight: "auto" }}>
            Back
          </button>
          <button
            type="button"
            className={`et-btn ${step === "published" ? "et-btn-success" : "et-btn-primary"}`}
            disabled={pending || (step === "scheduled" && !at)}
            onClick={() => onPick(step, step === "scheduled" ? new Date(at).toISOString() : undefined)}
          >
            {pending ? "Saving…" : step === "published" ? "Yes, publish" : step === "scheduled" ? "Confirm schedule" : "Yes, move to draft"}
          </button>
        </div>
      )}
    </dialog>
  );
}
