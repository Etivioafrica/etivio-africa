"use client";

import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { submitProject } from "../actions";

export function SubmitForm({ projectId, initial }: { projectId: string; initial?: { title: string; summary: string; link: string } }) {
  return (
    <ActionForm action={submitProject} toast>
      <input type="hidden" name="project_id" value={projectId} />
      <div className="et-field">
        <label htmlFor="s-title">Title of your work</label>
        <input id="s-title" name="title" required minLength={3} maxLength={120} defaultValue={initial?.title} />
      </div>
      <div className="et-field">
        <label htmlFor="s-summary">What did you build, and how?</label>
        <textarea id="s-summary" name="summary" rows={5} required minLength={20} maxLength={2000} defaultValue={initial?.summary} />
      </div>
      <div className="et-field">
        <label htmlFor="s-link">Link to your work</label>
        <input id="s-link" name="link_url" type="url" placeholder="https://… (Figma, GitHub, Google Drive, a website)" defaultValue={initial?.link} />
      </div>
      <SubmitButton pendingLabel="Sending…">{initial ? "Update submission" : "Submit your work"}</SubmitButton>
    </ActionForm>
  );
}
