"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Select } from "@/components/dash/Select";
import { createCommunity } from "../actions";

const MODES = [
  { value: "open", label: "Anyone can join", hint: "People join straight away." },
  { value: "request", label: "Request to join", hint: "People answer a question; you approve them." },
  { value: "course", label: "Students of a course", hint: "Anyone enrolled in the course can join." },
  { value: "invite", label: "Invite only", hint: "Only people with the invite link can join." },
] as const;

export function CreateCommunityForm({ courses, canOfficial }: { courses: { id: string; title: string }[]; canOfficial: boolean }) {
  const [state, action] = useActionState(createCommunity, null);
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("open");
  return (
    <form action={action} className="et-card et-card-pad et-form et-cm-create">
      <div className="et-field">
        <label htmlFor="cm-name">Name</label>
        <input id="cm-name" name="name" maxLength={80} required placeholder="e.g. Web design learners" />
      </div>
      <div className="et-field">
        <label htmlFor="cm-desc">What it&apos;s about</label>
        <textarea id="cm-desc" name="description" rows={3} maxLength={600} placeholder="Who it's for and what people do here." />
      </div>
      <div className="et-field">
        <label>Who can join</label>
        <input type="hidden" name="join_mode" value={mode} />
        <div className="et-cm-modes">
          {MODES.map((m) => (
            <button key={m.value} type="button" className={mode === m.value ? "is-on" : ""} onClick={() => setMode(m.value)} disabled={m.value === "course" && !courses.length}>
              <b>{m.label}</b>
              <small>{m.value === "course" && !courses.length ? "Publish a course first to link it." : m.hint}</small>
            </button>
          ))}
        </div>
      </div>
      {mode === "request" && (
        <div className="et-field">
          <label htmlFor="cm-q">Question for people asking to join</label>
          <input id="cm-q" name="join_question" maxLength={200} placeholder="e.g. What do you hope to learn here?" />
        </div>
      )}
      {mode === "course" && (
        <div className="et-field">
          <label htmlFor="cm-course">Course</label>
          <Select id="cm-course" name="course_id" defaultValue={courses[0]?.id ?? ""}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </div>
      )}
      {canOfficial && (
        <label className="et-check">
          <input type="checkbox" name="official" /> Official Etivio community (shows a badge and comes first)
        </label>
      )}
      {state?.error && <p className="et-flash et-flash-err">{state.error}</p>}
      <div className="et-form-foot">
        <Submit />
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="et-btn et-btn-primary" disabled={pending}>
      {pending ? "Creating…" : "Create community"}
    </button>
  );
}
