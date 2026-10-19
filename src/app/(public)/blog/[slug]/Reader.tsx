"use client";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageSquare } from "lucide-react";
import { fmtShort } from "@/lib/blog";
import type { PublicComment } from "@/lib/data/blog";

// Counts one view per post per browser tab every 30 minutes, then sends how long the reader stayed when they leave.
export function ViewTracker({ postId }: { postId: string }) {
  // Refs so a re-run of the effect (React does this in development) reuses the same view instead of losing it.
  const view = useRef<{ started: number; id: Promise<number | null>; sent: boolean } | null>(null);
  useEffect(() => {
    if (!view.current) {
      const key = `et-blog-view:${postId}`;
      try {
        if (Date.now() - Number(sessionStorage.getItem(key) ?? 0) < 30 * 60_000) return;
        sessionStorage.setItem(key, String(Date.now()));
      } catch {}
      view.current = {
        started: Date.now(),
        sent: false,
        id: fetch("/api/blog/views", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postId }) })
          .then((r) => r.json())
          .then((d: { viewId?: number | null }) => d.viewId ?? null)
          .catch(() => null),
      };
    }
    const v = view.current;
    const send = () => {
      const seconds = Math.round((Date.now() - v.started) / 1000);
      if (v.sent || seconds < 3) return;
      v.sent = true;
      v.id.then((viewId) => viewId !== null && navigator.sendBeacon("/api/blog/views", new Blob([JSON.stringify({ postId, viewId, seconds })], { type: "application/json" })));
    };
    const onHide = () => document.visibilityState === "hidden" && send();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", send);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", send);
    };
  }, [postId]);

  // Leaving through an in-app link unmounts the page: send the time then.
  useEffect(
    () => () => {
      const v = view.current;
      if (!v || v.sent) return;
      const seconds = Math.round((Date.now() - v.started) / 1000);
      if (seconds < 3) return;
      v.sent = true;
      v.id.then((viewId) => viewId !== null && navigator.sendBeacon("/api/blog/views", new Blob([JSON.stringify({ postId, viewId, seconds })], { type: "application/json" })));
    },
    [postId],
  );
  return null;
}

function fingerprint() {
  try {
    let fp = localStorage.getItem("et-fp");
    if (!fp) localStorage.setItem("et-fp", (fp = crypto.randomUUID()));
    return fp;
  } catch {
    return null;
  }
}

export function PostLike({ postId, initialCount }: { postId: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    const fp = fingerprint();
    if (!fp) return;
    fetch(`/api/blog/likes?postId=${postId}&fp=${fp}`)
      .then((r) => r.json())
      .then((d: { count: number; liked: boolean }) => {
        setCount(d.count);
        setLiked(d.liked);
      })
      .catch(() => {});
  }, [postId]);

  async function toggle() {
    const fp = fingerprint();
    if (!fp || busy) return;
    setBusy(true);
    const before = { count, liked };
    setLiked(!liked);
    setCount((c) => c + (liked ? -1 : 1));
    if (!liked) setPop(true);
    try {
      const r = await fetch("/api/blog/likes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postId, fp }) });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setCount(d.count);
      setLiked(d.liked);
    } catch {
      setCount(before.count);
      setLiked(before.liked);
    }
    setBusy(false);
  }

  return (
    <button type="button" className={`et-pp-likebtn${liked ? " is-on" : ""}${pop ? " is-pop" : ""}`} onClick={toggle} aria-pressed={liked} onAnimationEnd={() => setPop(false)}>
      <Heart size={16} fill={liked ? "currentColor" : "none"} />
      {count > 0 && <b>{count}</b>}
      {liked ? "Liked" : "Like"}
    </button>
  );
}

export function PostComments({ postId, comments }: { postId: string; comments: PublicComment[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    try {
      const r = await fetch("/api/blog/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postId, name, email, content, website }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Couldn't post your comment.");
      setState("sent");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post your comment.");
      setState("idle");
    }
  }

  return (
    <section className="et-pp-comments" id="comments">
      <h2>
        <MessageSquare size={18} /> {comments.length ? `${comments.length} ${comments.length === 1 ? "comment" : "comments"}` : "Comments"}
      </h2>
      {comments.length > 0 && (
        <ul>
          {comments.map((c) => (
            <li key={c.id}>
              <span className="et-avatar">{c.author_name.charAt(0).toUpperCase()}</span>
              <div>
                <p>
                  <b>{c.author_name}</b>
                  <small>{fmtShort(c.created_at)}</small>
                </p>
                <p className="et-pp-comment-text">{c.content}</p>
                {c.admin_reply && (
                  <div className="et-comment-reply">
                    <small>Etivio replied · {fmtShort(c.replied_at)}</small>
                    <p>{c.admin_reply}</p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="et-pp-form">
        <h3>Leave a comment</h3>
        {state === "sent" ? (
          <p className="et-flash et-flash-ok">Thanks for your comment. It shows up here once the team has had a look.</p>
        ) : (
          <form onSubmit={submit} className="et-form">
            <div className="et-grid-2">
              <div className="et-field">
                <label htmlFor="c-name">Name</label>
                <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Your name" autoComplete="name" />
              </div>
              <div className="et-field">
                <label htmlFor="c-email">
                  Email <span className="et-muted">(optional, never shown)</span>
                </label>
                <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} placeholder="you@example.com" autoComplete="email" />
              </div>
            </div>
            <div className="et-field">
              <label htmlFor="c-text">Comment</label>
              <textarea id="c-text" rows={4} value={content} onChange={(e) => setContent(e.target.value)} required maxLength={2000} placeholder="Share your thoughts…" />
            </div>
            <input className="et-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
            {error && <p className="et-flash et-flash-err">{error}</p>}
            <div>
              <button type="submit" className="et-btn et-btn-primary" disabled={state === "sending"}>
                {state === "sending" ? "Posting…" : "Post comment"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
