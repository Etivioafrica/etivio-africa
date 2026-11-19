"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { Heart, ImagePlus, Loader2, MessageCircle, Pencil, Pin, Send, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { ReportButton } from "@/components/moderation/ReportButton";
import { uploadFile } from "@/lib/upload-client";
import { addComment, createPost, deletePost, editComment, editPost, joinCommunity, loadComments, loadMorePosts, pinPost, toggleLike, updateRules } from "../actions";
import { CATEGORIES, type Category, type FeedPost, type JoinMode } from "@/lib/data/communities-shared";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const categoryLabel = (id: Category) => CATEGORIES.find((c) => c.id === id)?.label ?? "Discussion";

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
  const [category, setCategory] = useState<Category>("discussion");
  const [image, setImage] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const uploading = percent !== null;

  async function pick(f: File | undefined) {
    if (!f) return;
    setUploadError("");
    if (!f.type.startsWith("image/")) return setUploadError("Pick a photo (JPG, PNG, WebP or GIF).");
    if (f.size > 10 * 1024 * 1024) return setUploadError("Photos can be up to 10 MB.");
    setPercent(0);
    try {
      const up = await uploadFile("post", f, f.name || "photo.jpg", { onProgress: setPercent, onChecking: () => setPercent(100) });
      setImage(up.url);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setPercent(null);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setText("");
        setImage(null);
        setCategory("discussion");
      }}
      className="et-card et-card-pad et-cm-compose"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="image_url" value={image ?? ""} />
      <textarea name="body" rows={3} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share something, ask a question or post a win…" />
      {image && (
        <div className="et-cm-attach">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Attached photo" />
          <button type="button" className="et-icon-btn" aria-label="Remove photo" onClick={() => setImage(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="et-cm-compose-foot">
        <span className="et-cm-compose-tools">
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => void pick(e.target.files?.[0])} />
          <button type="button" className="et-icon-btn" aria-label="Add a photo" title="Add a photo" disabled={uploading || busy} onClick={() => file.current?.click()}>
            {uploading ? <Loader2 size={16} className="et-spin" /> : <ImagePlus size={16} />}
          </button>
          {uploading && <small className="et-muted">{percent === 100 ? "Checking…" : `${percent}%`}</small>}
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value as Category)} aria-label="Post type" className="et-cm-select">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </span>
        <button type="submit" className="et-btn et-btn-primary et-btn-sm" disabled={busy || uploading || text.trim().length < 2}>
          <Send size={14} /> {busy ? "Posting…" : "Post"}
        </button>
      </div>
      {uploadError ? <p className="et-gb-error">{uploadError}</p> : state?.error ? <p className="et-gb-error">{state.error}</p> : state?.ok && state.ok !== "Posted." ? <p className="et-cm-note">{state.ok}</p> : null}
    </form>
  );
}

// The feed: the first page comes from the server; "Load more" asks for older posts.
export function Feed({ initial, hasMore, slug, category, canModerate, viewerId }: { initial: FeedPost[]; hasMore: boolean; slug: string; category?: string; canModerate: boolean; viewerId: string }) {
  const [posts, setPosts] = useState(initial);
  const [more, setMore] = useState(hasMore);
  const [busy, start] = useTransition();
  const [error, setError] = useState("");

  function loadMore() {
    const last = [...posts].reverse().find((p) => !p.pinned) ?? posts[posts.length - 1];
    if (!last) return;
    setError("");
    start(async () => {
      try {
        const next = await loadMorePosts(slug, last.createdAt, category);
        setPosts((cur) => [...cur, ...next.posts.filter((p) => !cur.some((x) => x.id === p.id))]);
        setMore(next.hasMore);
      } catch {
        setError("Couldn't load more. Try again.");
      }
    });
  }

  if (!posts.length) return <p className="et-muted et-cm-empty">{category ? "No posts of this type yet." : "No posts yet. Start the conversation."}</p>;
  return (
    <>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} canModerate={canModerate} viewerId={viewerId} />
      ))}
      {more && (
        <button type="button" className="et-btn et-btn-ghost et-cm-more" onClick={loadMore} disabled={busy}>
          {busy ? "Loading…" : "Load more posts"}
        </button>
      )}
      {error && <p className="et-gb-error">{error}</p>}
    </>
  );
}

type Comment = { id: string; body: string; createdAt: string; editedAt?: string | null; author: string; mine?: boolean };

function CommentRow({ c }: { c: Comment }) {
  const [body, setBody] = useState(c.body);
  const [edited, setEdited] = useState(Boolean(c.editedAt));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  function save() {
    setError("");
    start(async () => {
      const res = await editComment(c.id, draft);
      if (res.error || res.body === undefined) return setError(res.error ?? "Couldn't save.");
      setBody(res.body);
      setEdited(true);
      setEditing(false);
    });
  }

  return (
    <div className="et-cm-comment">
      <b>{c.author}</b> <small>{when(c.createdAt)}{edited ? " · edited" : ""}</small>
      {c.mine ? (
        !editing && (
          <button type="button" className="et-icon-btn et-cm-edit" aria-label="Edit comment" title="Edit comment" onClick={() => (setDraft(body), setEditing(true))}>
            <Pencil size={12} />
          </button>
        )
      ) : (
        <ReportButton type="community_comment" id={c.id} small />
      )}
      {editing ? (
        <div className="et-cm-reply">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} aria-label="Edit comment" autoFocus />
          <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={save} disabled={busy || !draft.trim()}>
            Save
          </button>
          <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <p>{body}</p>
      )}
      {error && <p className="et-gb-error">{error}</p>}
    </div>
  );
}

export function PostCard({ post, canModerate, viewerId }: { post: FeedPost; canModerate: boolean; viewerId: string }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [count, setCount] = useState(post.comments);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [body, setBody] = useState(post.body);
  const [edited, setEdited] = useState(Boolean(post.editedAt));
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(post.body);
  const [editError, setEditError] = useState("");
  const mine = post.author.id === viewerId;

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
    const t = draft.trim();
    if (!t) return;
    setError("");
    start(async () => {
      const res = await addComment(post.id, t);
      if (res.error || !res.comment) return setError(res.error ?? "Couldn't comment.");
      setComments((c) => [...(c ?? []), { ...res.comment!, mine: true }]);
      setCount((n) => n + 1);
      setDraft("");
    });
  }
  function saveEdit() {
    setEditError("");
    start(async () => {
      const res = await editPost(post.id, text);
      if (res.error) return setEditError(res.error);
      setBody(text.trim());
      setEdited(true);
      setEditing(false);
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
            {edited ? " · edited" : ""}
            {post.pinned ? " · Pinned" : ""}
            {post.hidden ? " · Waiting for a check" : ""}
          </small>
        </span>
        {post.category !== "discussion" && <span className={`et-cm-tag is-${post.category}`}>{categoryLabel(post.category)}</span>}
        {!mine && <ReportButton type="community_post" id={post.id} />}
        {(canModerate || mine) && (
          <span className="et-cm-tools">
            {mine && !editing && (
              <button type="button" className="et-icon-btn" aria-label="Edit post" title="Edit post" onClick={() => (setText(body), setEditing(true))}>
                <Pencil size={14} />
              </button>
            )}
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
      {editing ? (
        <div className="et-cm-editbox">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={5000} aria-label="Edit post" autoFocus />
          <div className="et-cm-editrow">
            <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={saveEdit} disabled={busy || text.trim().length < 2}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
          {editError && <p className="et-gb-error">{editError}</p>}
        </div>
      ) : (
        <p className="et-cm-body">{body}</p>
      )}
      {post.image && (
        <a href={post.image} target="_blank" rel="noopener noreferrer" className="et-cm-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.image} alt="" loading="lazy" />
        </a>
      )}
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
          {comments === null ? <p className="et-muted">Loading…</p> : comments.map((c) => <CommentRow key={c.id} c={c} />)}
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
            <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={send} disabled={busy || !draft.trim()} aria-label="Send comment">
              <Send size={13} />
            </button>
          </div>
          {error && <p className="et-gb-error">{error}</p>}
        </div>
      )}
    </article>
  );
}

// Owner-only: set the rules everyone sees in the sidebar.
export function RulesEditor({ slug, rules }: { slug: string; rules: string | null }) {
  const [state, action, busy] = useActionState(updateRules, null);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setOpen(true)}>
        <Pencil size={13} /> {rules ? "Edit rules" : "Add rules"}
      </button>
    );
  return (
    <form action={action} className="et-cm-join">
      <input type="hidden" name="slug" value={slug} />
      <textarea name="rules" rows={5} maxLength={2000} defaultValue={rules ?? ""} aria-label="Community rules" placeholder="e.g. Be kind. No spam. Keep questions on topic." style={{ width: "100%" }} />
      <span className="et-cm-editrow">
        <button type="submit" className="et-btn et-btn-primary et-btn-sm" disabled={busy}>
          {busy ? "Saving…" : "Save rules"}
        </button>
        <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setOpen(false)}>
          Close
        </button>
      </span>
      {state?.error && <p className="et-gb-error">{state.error}</p>}
      {state?.ok && <p className="et-cm-note">{state.ok}</p>}
    </form>
  );
}
