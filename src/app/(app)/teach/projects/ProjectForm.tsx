"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { RichTextEditor } from "@/components/dash/RichTextEditor";
import { saveProject } from "./actions";

type Initial = { id?: string; title?: string; brief?: string; skills?: string[]; level?: string; due?: string; courseId?: string | null; status?: string };

// Brief editor for tutors and coaches. Drafts stay private until published.
export function ProjectForm({ initial = {}, courses }: { initial?: Initial; courses: { id: string; title: string }[] }) {
  const [brief, setBrief] = useState(initial.brief ?? "");
  return (
    <ActionForm action={saveProject} toast>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="brief" value={brief} />
      <div className="et-field">
        <label htmlFor="p-title">Project title</label>
        <input id="p-title" name="title" defaultValue={initial.title} required minLength={4} maxLength={120} placeholder="Design a landing page for a local business" />
      </div>
      <div className="et-field">
        <label>The brief</label>
        <small className="et-muted">What should learners build? Include the goal, what to hand in and how you will judge it.</small>
        <RichTextEditor value={brief} onChange={setBrief} />
      </div>
      <div className="et-form-grid">
        <div className="et-field">
          <label htmlFor="p-skills">Skills (comma separated)</label>
          <input id="p-skills" name="skills" defaultValue={(initial.skills ?? []).join(", ")} placeholder="Figma, layout, copywriting" />
        </div>
        <div className="et-field">
          <label htmlFor="p-level">Level</label>
          <select id="p-level" name="level" defaultValue={initial.level ?? "beginner"}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="et-field">
          <label htmlFor="p-due">Due date (optional)</label>
          <input id="p-due" name="due" type="date" defaultValue={initial.due} />
        </div>
        <div className="et-field">
          <label htmlFor="p-course">Linked course (optional)</label>
          <select id="p-course" name="course_id" defaultValue={initial.courseId ?? ""}>
            <option value="">No course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="et-form-foot" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <SubmitButton className="et-btn et-btn-ghost">{initial.id ? "Save changes" : "Save draft"}</SubmitButton>
        {initial.status !== "open" && (
          <button type="submit" name="publish" value="1" className="et-btn et-btn-primary">
            Save and publish
          </button>
        )}
      </div>
    </ActionForm>
  );
}
