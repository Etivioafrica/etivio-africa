"use client";
import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { submitReview } from "@/app/(app)/learn/course-actions";

type Mine = { rating: number; body: string | null; approved: boolean; admin_reply: string | null } | null;

// Rate the course once you're 30% through. Editing an approved review sends it back for a quick check.
export function ReviewCard({ courseId, canReview, mine, progress }: { courseId: string; canReview: boolean; mine: Mine; progress: number }) {
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(mine?.body ?? "");
  const [editing, setEditing] = useState(!mine);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();

  if (!canReview)
    return (
      <section className="et-card et-card-pad et-review-card">
        <b>Rate this course</b>
        <p className="et-muted">You can leave a review once you&apos;re 30% through. You&apos;re at {progress}%.</p>
        <span className="et-progress">
          <span style={{ width: `${Math.min(100, (progress / 30) * 100)}%` }} />
        </span>
      </section>
    );

  return (
    <section className="et-card et-card-pad et-review-card">
      <b>{mine && !editing ? "Your review" : "Rate this course"}</b>
      <div className="et-review-stars" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            disabled={!editing || pending}
            onMouseEnter={() => editing && setHover(n)}
            onClick={() => setRating(n)}
            className={(hover || rating) >= n ? "is-on" : ""}
          >
            <Star size={22} fill={(hover || rating) >= n ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      {editing ? (
        <>
          <textarea className="et-input" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you like? What could be better? (optional)" />
          <button
            type="button"
            className="et-btn et-btn-primary"
            disabled={!rating || pending}
            onClick={() =>
              start(async () => {
                const res = await submitReview(courseId, rating, body);
                setMsg(res);
                if (!res.error) setEditing(false);
              })
            }
          >
            {pending ? "Sending…" : mine ? "Update review" : "Submit review"}
          </button>
        </>
      ) : (
        <>
          {body && <p className="et-review-mine">{body}</p>}
          <small className="et-muted">{msg?.ok ?? (mine?.approved ? "Published on the course." : "Waiting for a quick check before it shows.")}</small>
          {mine?.admin_reply && (
            <div className="et-comment-reply" style={{ margin: 0 }}>
              <small>Etivio replied</small>
              <p>{mine.admin_reply}</p>
            </div>
          )}
          <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setEditing(true)}>
            Edit review
          </button>
        </>
      )}
      {msg?.error && <p className="et-flash et-flash-err">{msg.error}</p>}
    </section>
  );
}
