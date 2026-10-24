"use client";
import { useActionState, useState, useTransition } from "react";
import { Heart, MessageCircle, Pin, Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { ReportButton } from "@/components/moderation/ReportButton";
import { addComment, createPost, deletePost, joinCommunity, loadComments, pinPost, toggleLike } from "../actions";
import type { FeedPost, JoinMode } from "@/lib/data/communities";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function JoinBox({ slug, mode, question, invite, pending }: { slug: string; mode: JoinMode; question: string | null; invite: string; pending: boolean }) {
  const [state, action, busy] = useActionState(joinCommunity, null);
  if (pending || state?.ok?.startsWith("Request sent")) return <p className="et-cm-note">Your request is waiting for a moderator. You&apos;ll see the posts once you&apos;re in.</p>;
  return (
    <form action={action} className="et-cm-join">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="invite" value={invite} />
      {mode === "request" && question && (
        <div className="et-field">
          <label htmlFor="cm-answer">{question}</label>
          <textarea id="cm-answer" name="answer" rows={2} maxLength={500} />
        </div>
      )}
      <button type="submit" className="et-btn et-btn-primary" disabled={busy}>
        {busy ? "Joining…" : mode === "request" ? "Ask to join" : "Join community"}
      </button>
      {state?.error && <p className="et-gb-error">{state.error}</p>}
    </form>
  );
}

export function Composer({ slug }: { slug: string }) {
  const [state, action, busy] = useActionState(createPost, null);
  const [text, setText] = useState("");
  return (
    <form
      action={async (fd) => {
        await action(fd);
        setText("");
      }}
      className="et-card et-card-pad et-cm-compose"
    >
      <input type="hidden" name="slug" value={slug} />
      <textarea name="body" rows={3} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share something, ask a question or post a win…" />
      <div className="et-cm-compose-foot">
        {state?.error ? <p className="et-gb-error">{state.error}</p> : state?.ok && state.ok !== "Posted." ? <p className="et-cm-note">{state.ok}</p> : <span />}
        <button type="submit" className="et-btn et-btn-primary et-btn-sm" disabled={busy || text.trim().length < 2}>
          <Send size={14} /> {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

type Comment = { id: string; body: string; createdAt: string; author: string; mine?: boolean };

export function PostCard({ post, canModerate, viewerId }: { post: FeedPost; canModerate: boolean; viewerId: string }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [count, setCount] = useState(post.comments);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  function like() {
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    start(async () => {
      const res = await toggleLike(post.id);
      if (res.error) {
        setLiked(liked);
        setLikes(post.likes);
      }
    });
  }
  function toggleComments() {
    setOpen(!open);
    if (!comments) start(async () => setComments(await loadComments(post.id)));
  }
  function send() {
    const text = draft.trim();
    if (!text) return;
    setError("");
    start(async () => {
      const res = await addComment(post.id, text);
      if (res.error || !res.comment) return setError(res.error ?? "Couldn't comment.");
      setComments((c) => [...(c ?? []), { ...res.comment!, mine: true }]);
      setCount((n) => n + 1);
      setDraft("");
    });
  }

  return (
    <article className={`et-card et-cm-post${post.pinned ? " is-pinned" : ""}`}>
      <header>
        <Avatar src={post.author.avatar} initial={post.author.name.charAt(0).toUpperCase()} seed={post.author.name} className="et-cm-face" />
        <span>
          <b>{post.author.name}</b>
          <small>
            {when(post.createdAt)}
            {post.pinned ? " · Pinned" : ""}
            {post.hidden ? " · Waiting for a check" : ""}
          </small>
        </span>
        {post.author.id !== viewerId && <ReportButton type="community_post" id={post.id} />}
        {(canModerate || post.author.id === viewerId) && (
          <span className="et-cm-tools">
            {canModerate && (
              <form action={pinPost}>
                <input type="hidden" name="post_id" value={post.id} />
                <input type="hidden" name="pinned" value={post.pinned ? "0" : "1"} />
                <button type="submit" className="et-icon-btn" aria-label={post.pinned ? "Unpin" : "Pin to top"} title={post.pinned ? "Unpin" : "Pin to top"}>
                  <Pin size={14} />
                </button>
              </form>
            )}
            <form action={deletePost}>
              <input type="hidden" name="post_id" value={post.id} />
              <button type="submit" className="et-icon-btn" aria-label="Delete post" title="Delete post">
                <Trash2 size={14} />
              </button>
            </form>
          </span>
        )}
      </header>
      <p className="et-cm-body">{post.body}</p>
      <footer>
        <button type="button" className={`et-cm-act${liked ? " is-on" : ""}`} onClick={like} disabled={busy}>
          <Heart size={15} fill={liked ? "currentColor" : "none"} /> {likes || ""}
        </button>
        <button type="button" className="et-cm-act" onClick={toggleComments}>
          <MessageCircle size={15} /> {count ? `${count} ${count === 1 ? "comment" : "comments"}` : "Comment"}
        </button>
      </footer>
      {open && (
        <div className="et-cm-comments">
          {comments === null ? (
            <p className="et-muted">Loading…</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="et-cm-comment">
                <b>{c.author}</b> <small>{when(c.createdAt)}</small>
                {!c.mine && <ReportButton type="community_comment" id={c.id} small />}
                <p>{c.body}</p>
              </div>
            ))
          )}
          <div className="et-cm-reply">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              placeholder="Write a comment…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={send} disabled={busy || !draft.trim()}>
              <Send size={13} />
            </button>
          </div>
          {error && <p className="et-gb-error">{error}</p>}
        </div>
      )}
    </article>
  );
}
