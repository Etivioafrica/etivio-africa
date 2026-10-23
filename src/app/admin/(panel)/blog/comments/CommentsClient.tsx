"use client";
import { useState, useTransition } from "react";
import { defaultAvatar } from "@/lib/avatars";
import Link from "next/link";
import { Check, EyeOff, MessageSquareReply, Trash2 } from "lucide-react";
import { useToast } from "@/components/dash/useToast";
import { fmtShort } from "@/lib/blog";
import { approveComment, deleteComment, replyToComment } from "../actions";

type Comment = {
  id: string;
  author_name: string;
  author_email: string | null;
  user_id: string | null;
  content: string;
  approved: boolean;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  post: { title: string; slug: string } | null;
};
type Filter = "all" | "pending" | "approved";

export function CommentsClient({ comments, initialFilter }: { comments: Comment[]; initialFilter: Filter }) {
  const [toast, show] = useToast();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [replying, setReplying] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const waiting = comments.filter((c) => !c.approved).length;
  const shown = comments.filter((c) => (filter === "all" ? true : filter === "pending" ? !c.approved : c.approved));

  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      show(res);
      if (!res.error) after?.();
    });

  return (
    <>
      {toast}
      <div className="et-page-head">
        <div>
          <h1>Comments</h1>
          <p>
            {comments.length} in total · {waiting} waiting for review. New comments stay hidden until you approve them.
          </p>
        </div>
      </div>

      <nav className="et-blog-filter is-solo" aria-label="Filter comments">
        {(["all", "pending", "approved"] as Filter[]).map((f) => (
          <button key={f} type="button" className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)} aria-pressed={filter === f}>
            {f === "all" ? "All" : f === "pending" ? "Waiting" : "Approved"}
            <span>{f === "all" ? comments.length : f === "pending" ? waiting : comments.length - waiting}</span>
          </button>
        ))}
      </nav>

      {shown.length === 0 ? (
        <section className="et-card">
          <p className="et-empty">{filter === "pending" ? "Nothing waiting. You're all caught up." : "No comments yet."}</p>
        </section>
      ) : (
        <div className="et-comments">
          {shown.map((c) => (
            <article key={c.id} className="et-card">
              <header>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={defaultAvatar(c.author_name)} alt="" className="et-avatar" />
                <div>
                  <p>
                    <b>{c.author_name}</b>
                    {c.author_email && <small>{c.author_email}</small>}
                    {c.user_id && <span className="et-tag">Etivio member</span>}
                    <span className={`et-blog-status is-static ${c.approved ? "is-published" : "is-scheduled"}`}>
                      <i />
                      {c.approved ? "Approved" : "Waiting"}
                    </span>
                  </p>
                  <small>
                    {fmtShort(c.created_at)}
                    {c.post && (
                      <>
                        {" · on "}
                        <Link href={`/blog/${c.post.slug}`} target="_blank">
                          {c.post.title}
                        </Link>
                      </>
                    )}
                  </small>
                </div>
                <span className="et-inline">
                  {c.approved ? (
                    <button type="button" className="et-btn et-btn-ghost et-btn-sm" disabled={pending} onClick={() => run(() => approveComment(c.id, false))}>
                      <EyeOff size={13} /> Hide
                    </button>
                  ) : (
                    <button type="button" className="et-btn et-btn-success et-btn-sm" disabled={pending} onClick={() => run(() => approveComment(c.id, true))}>
                      <Check size={13} /> Approve
                    </button>
                  )}
                  <button
                    type="button"
                    className="et-btn et-btn-ghost et-btn-sm"
                    onClick={() => {
                      setReplying(replying === c.id ? null : c.id);
                      setReply(c.admin_reply ?? "");
                    }}
                  >
                    <MessageSquareReply size={13} /> {c.admin_reply ? "Edit reply" : "Reply"}
                  </button>
                  <button
                    type="button"
                    className="et-icon-btn is-danger"
                    disabled={pending}
                    aria-label="Delete comment"
                    onClick={() => window.confirm("Delete this comment for good?") && run(() => deleteComment(c.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </header>
              <p className="et-comment-body">{c.content}</p>
              {c.admin_reply && replying !== c.id && (
                <div className="et-comment-reply">
                  <small>Etivio replied · {fmtShort(c.replied_at)}</small>
                  <p>{c.admin_reply}</p>
                </div>
              )}
              {replying === c.id && (
                <div className="et-comment-form">
                  <textarea className="et-input" rows={3} value={reply} autoFocus maxLength={2000} placeholder="Write your reply. It shows under the comment, signed by Etivio." onChange={(e) => setReply(e.target.value)} />
                  <div className="et-inline">
                    <button type="button" className="et-btn et-btn-primary et-btn-sm" disabled={pending || !reply.trim()} onClick={() => run(() => replyToComment(c.id, reply), () => setReplying(null))}>
                      {pending ? "Saving…" : "Post reply"}
                    </button>
                    {c.admin_reply && (
                      <button type="button" className="et-btn et-btn-ghost et-btn-sm" disabled={pending} onClick={() => run(() => replyToComment(c.id, ""), () => setReplying(null))}>
                        Remove reply
                      </button>
                    )}
                    <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setReplying(null)}>
                      Cancel
                    </button>
                  </div>
                  {!c.approved && <small className="et-muted">Replying also approves the comment.</small>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
