"use server";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderate } from "@/lib/moderation";
import type { FormState } from "@/app/(app)/teach/actions";

// A learner hands in (or updates) their work for an open project. One submission per person per project.
export async function submitProject(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const db = createAdminClient();
  const projectId = String(fd.get("project_id") ?? "");
  const { data: project } = await db.from("projects").select("id, status, author_id, due_at").eq("id", projectId).maybeSingle();
  if (!project || project.status !== "open") return { error: "This project is not taking submissions." };
  if (project.author_id === user.id) return { error: "You can't submit to your own project." };
  if (project.due_at && Date.parse(project.due_at) < Date.now()) return { error: "The due date for this project has passed." };

  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const summary = String(fd.get("summary") ?? "").trim().slice(0, 2000);
  const link = String(fd.get("link_url") ?? "").trim().slice(0, 500);
  if (title.length < 3) return { error: "Give your work a title." };
  if (summary.length < 20) return { error: "Tell the tutor what you built and how (at least a sentence or two)." };
  if (link && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(link)) return { error: "The link should start with https:// (for example a Figma, GitHub, Google Drive or website link)." };
  const check = await moderate("project_submission", user.id, [title, summary, link], `/projects/${projectId}`);
  if (check.error) return { error: check.error };

  const now = new Date().toISOString();
  const { data: existing } = await db.from("project_submissions").select("id, status").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
  if (existing?.status === "hidden") return { error: "Your submission was hidden by the tutor. Contact support if you think that's a mistake." };
  const row = { title, summary, link_url: link || null, updated_at: now };
  const { error } = existing
    ? await db.from("project_submissions").update({ ...row, status: existing.status === "featured" ? "featured" : "submitted" }).eq("id", existing.id)
    : await db.from("project_submissions").insert({ ...row, project_id: projectId, user_id: user.id });
  if (error) return { error: "Could not save your submission." };
  refresh();
  return { ok: existing ? "Submission updated." : "Submitted! The tutor will review it and leave feedback." };
}
