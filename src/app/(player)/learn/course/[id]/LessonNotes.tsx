"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bookmark, NotebookPen } from "lucide-react";
import { saveLessonNote, setBookmark } from "@/app/(app)/learn/actions";

// Private notes + bookmark for the current lesson. Notes autosave a moment after typing stops.
export function LessonNotes({ lessonId, initialBody, initialBookmarked }: { lessonId: string; initialBody: string; initialBookmarked: boolean }) {
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [, startBookmark] = useTransition();
  const last = useRef(initialBody);

  useEffect(() => {
    if (body === last.current) return;
    const t = setTimeout(async () => {
      setStatus("saving");
      const res = await saveLessonNote(lessonId, body);
      last.current = body;
      setStatus(res.ok ? "saved" : "error");
    }, 800);
    return () => clearTimeout(t);
  }, [body, lessonId]);

  return (
    <div className="et-notes">
      <div className="et-notes-head">
        <h3>
          <NotebookPen size={15} /> My notes
        </h3>
        <button
          type="button"
          className={`et-btn et-btn-sm ${bookmarked ? "et-btn-primary" : "et-btn-ghost"}`}
          aria-pressed={bookmarked}
          onClick={() => {
            const on = !bookmarked;
            setBookmarked(on);
            startBookmark(async () => {
              const res = await setBookmark(lessonId, on);
              if (!res.ok) setBookmarked(!on);
            });
          }}
        >
          <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
          {bookmarked ? "Bookmarked" : "Bookmark lesson"}
        </button>
      </div>
      <textarea
        className="et-input"
        value={body}
        onChange={(e) => {
          setStatus("idle");
          setBody(e.target.value);
        }}
        placeholder="Jot down key ideas, questions, or things to try. Only you can see these."
        rows={4}
        maxLength={10000}
        aria-label="Notes for this lesson"
      />
      <small className={`et-notes-status${status === "error" ? " is-err" : ""}`} aria-live="polite">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Couldn't save. Check your connection." : "Notes save automatically."}
      </small>
    </div>
  );
}
