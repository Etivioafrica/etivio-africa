"use client";
import { useActionState, useRef } from "react";
import type { NotificationPrefs } from "@/lib/data/profile";
import { updateNotifications } from "../actions";

const PREFS = [
  { key: "course_updates", label: "Course updates", hint: "New lessons and announcements in courses you're enrolled in." },
  { key: "support_replies", label: "Support replies", hint: "When the Etivio team replies to your support chat." },
  { key: "product_news", label: "Etivio news", hint: "New courses, features, and occasional offers." },
] as const;

// Each switch saves as soon as it flips.
export function NotificationToggles({ prefs }: { prefs: NotificationPrefs }) {
  const [state, action, pending] = useActionState(updateNotifications, null);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={action} className="et-set-box">
      {PREFS.map((p) => (
        <label key={p.key} className="et-set-box-row">
          <span>
            <b>{p.label}</b>
            <small>{p.hint}</small>
          </span>
          <input type="checkbox" role="switch" className="et-toggle" name={p.key} defaultChecked={prefs[p.key]} onChange={() => form.current?.requestSubmit()} />
        </label>
      ))}
      <p className={`et-set-saved${state?.error ? " is-err" : ""}`} aria-live="polite">
        {pending ? "Saving…" : (state?.error ?? (state?.ok ? "Saved" : ""))}
      </p>
    </form>
  );
}
