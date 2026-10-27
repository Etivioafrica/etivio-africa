"use client";
import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { setLessonDone } from "@/app/(app)/learn/actions";
import { LESSON_WATCH } from "@/components/learn/LessonVideo";
import type { WatchState } from "@/app/(app)/learn/course-actions";

// Marks the lesson complete. On video lessons it stays locked until enough of the video has been played; the
// player reports progress as it goes, so it unlocks without a reload.
export function LessonCompleteButton({
  lessonId,
  done,
  label,
  nextHref,
  watch,
}: {
  lessonId: string;
  done: boolean;
  label: string;
  nextHref?: string;
  // Null when the lesson has no video or watching isn't required (course owners, or before tracking is set up).
  watch: WatchState | null;
}) {
  const [state, setState] = useState(watch);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<WatchState & { lessonId?: string }>).detail;
      if (d.lessonId === lessonId) setState({ watched: d.watched, duration: d.duration, qualified: d.qualified });
    };
    window.addEventListener(LESSON_WATCH, on);
    return () => window.removeEventListener(LESSON_WATCH, on);
  }, [lessonId]);

  const locked = !done && !!state && !state.qualified;
  const pct = state?.duration ? Math.min(100, Math.round((state.watched / state.duration) * 100)) : 0;

  if (locked)
    return (
      <div className="et-pl-lock" title="Watch the video to unlock">
        <button type="button" className="et-btn et-btn-primary" disabled>
          <Lock size={14} /> Watch to complete
        </button>
        <span className="et-pl-lock-bar" aria-label={`${pct}% watched`}>
          <span style={{ width: `${Math.min(100, (pct / 90) * 100)}%` }} />
        </span>
        <small>{pct}% watched · 90% needed</small>
      </div>
    );

  return (
    <form action={setLessonDone}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="done" value={done ? "0" : "1"} />
      {nextHref && <input type="hidden" name="next" value={nextHref} />}
      <button type="submit" className={`et-btn ${done ? "et-btn-success" : "et-btn-primary"}`} title={done ? "Click to mark as not done" : undefined}>
        <Check size={15} />
        {label}
      </button>
    </form>
  );
}
