"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, EyeOff, MessageSquareReply, Star, Trash2 } from "lucide-react";
import { useToast } from "@/components/dash/useToast";
import { fmtShort } from "@/lib/blog";
import { approveReview, deleteReview, replyToReview } from "../actions";
import { approveProductReview, deleteProductReview, replyToProductReview } from "../../marketplace/actions";
import { Avatar } from "@/components/dash/Avatar";
import { confirmDialog } from "@/components/dash/dialogs";

export type Review = {
  id: string;
  rating: number;
  body: string | null;
  approved: boolean;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  user_id: string;
  course_id: string;
  author: string;
  avatar: string | null;
  course: string;
};
type Filter = "all" | "pending" | "approved";

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="et-stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= value ? "currentColor" : "none"} className={n <= value ? "is-on" : ""} />
      ))}
    </span>
  );
}

const ACTIONS = {
  course: { approve: approveReview, reply: replyToReview, remove: deleteReview, href: (id: string) => `/admin/courses/${id}?tab=reviews` },
  product: { approve: approveProductReview, reply: replyToProductReview, remove: deleteProductReview, href: (id: string) => `/admin/marketplace/${id}` },
};

// Course reviews by default. With kind="product", `course_id` and `course` hold the product's id and title.
export function ReviewsClient({ reviews, initialFilter = "all", hideCourse, kind = "course" }: { reviews: Review[]; initialFilter?: Filter; hideCourse?: boolean; kind?: "course" | "product" }) {
  const act = ACTIONS[kind];
  const [toast, show] = useToast();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [replying, setReplying] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const waiting = reviews.filter((r) => !r.approved).length;
  const shown = reviews.filter((r) => (filter === "all" ? true : filter === "pending" ? !r.approved : r.approved));
  const approved = reviews.filter((r) => r.approved);
  const avg = approved.length ? approved.reduce((n, r) => n + r.rating, 0) / approved.length : 0;
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      show(res);
      if (!res.error) after?.();
    });

  return (
    <>
      {toast}
      {approved.length > 0 && (
        <section className="et-card et-review-summary">
          <div>
            <strong>{avg.toFixed(1)}</strong>
            <Stars value={Math.round(avg)} size={16} />
            <small>
              {approved.length} published {approved.length === 1 ? "review" : "reviews"}
            </small>
          </div>
          <ul>
            {[5, 4, 3, 2, 1].map((n) => {
              const c = approved.filter((r) => r.rating === n).length;
              return (
                <li key={n}>
                  <span>{n} ★</span>
                  <span className="et-funnel-bar">
                    <span style={{ width: `${(c / approved.length) * 100}%` }} />
                  </span>
                  <small>{c}</small>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <nav className="et-blog-filter is-solo" aria-label="Filter reviews">
        {(["all", "pending", "approved"] as Filter[]).map((f) => (
          <button key={f} type="button" className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)} aria-pressed={filter === f}>
            {f === "all" ? "All" : f === "pending" ? "Waiting" : "Published"}
            <span>{f === "all" ? reviews.length : f === "pending" ? waiting : reviews.length - waiting}</span>
          </button>
        ))}
      </nav>

      {shown.length === 0 ? (
        <section className="et-card">
          <p className="et-empty">{filter === "pending" ? "Nothing waiting. You're all caught up." : "No reviews yet."}</p>
        </section>
      ) : (
        <div className="et-comments">
          {shown.map((r) => (
            <article key={r.id} className="et-card">
              <header>
                <Avatar src={r.avatar} initial={r.author.charAt(0).toUpperCase()} seed={r.author} className="et-avatar" />
                <div>
                  <p>
                    <Link href={`/admin/users/${r.user_id}`}>
                      <b>{r.author}</b>
                    </Link>
                    <Stars value={r.rating} />
                    <span className={`et-blog-status is-static ${r.approved ? "is-published" : "is-scheduled"}`}>
                      <i />
                      {r.approved ? "Published" : "Waiting"}
                    </span>
                  </p>
                  <small>
                    {fmtShort(r.created_at)}
                    {!hideCourse && (
                      <>
                        {" · "}
                        <Link href={act.href(r.course_id)}>{r.course}</Link>
                      </>
                    )}
                  </small>
                </div>
                <span className="et-inline">
                  {r.approved ? (
                    <button type="button" className="et-btn et-btn-ghost et-btn-sm" disabled={pending} onClick={() => run(() => act.approve(r.id, false))}>
                      <EyeOff size={13} /> Hide
                    </button>
                  ) : (
                    <button type="button" className="et-btn et-btn-success et-btn-sm" disabled={pending} onClick={() => run(() => act.approve(r.id, true))}>
                      <Check size={13} /> Approve
                    </button>
                  )}
                  <button
                    type="button"
                    className="et-btn et-btn-ghost et-btn-sm"
                    onClick={() => {
                      setReplying(replying === r.id ? null : r.id);
                      setReply(r.admin_reply ?? "");
                    }}
                  >
                    <MessageSquareReply size={13} /> {r.admin_reply ? "Edit reply" : "Reply"}
                  </button>
                  <button type="button" className="et-icon-btn is-danger" disabled={pending} aria-label="Delete review" onClick={async () => (await confirmDialog({ title: "Delete this review?", body: "It's removed for good.", confirmLabel: "Delete", danger: true })) && run(() => act.remove(r.id))}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </header>
              {r.body ? <p className="et-comment-body">{r.body}</p> : <p className="et-comment-body et-muted">Rated without a written review.</p>}
              {r.admin_reply && replying !== r.id && (
                <div className="et-comment-reply">
                  <small>Etivio replied · {fmtShort(r.replied_at)}</small>
                  <p>{r.admin_reply}</p>
                </div>
              )}
              {replying === r.id && (
                <div className="et-comment-form">
                  <textarea className="et-input" rows={3} value={reply} autoFocus maxLength={2000} placeholder="Reply publicly. It shows under the review, signed by Etivio." onChange={(e) => setReply(e.target.value)} />
                  <div className="et-inline">
                    <button type="button" className="et-btn et-btn-primary et-btn-sm" disabled={pending || !reply.trim()} onClick={() => run(() => act.reply(r.id, reply), () => setReplying(null))}>
                      {pending ? "Saving…" : "Post reply"}
                    </button>
                    {r.admin_reply && (
                      <button type="button" className="et-btn et-btn-ghost et-btn-sm" disabled={pending} onClick={() => run(() => act.reply(r.id, ""), () => setReplying(null))}>
                        Remove reply
                      </button>
                    )}
                    <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setReplying(null)}>
                      Cancel
                    </button>
                  </div>
                  {!r.approved && <small className="et-muted">Replying also publishes the review.</small>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
