"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canEarn } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeRichText } from "@/lib/sanitize";
import { moderate } from "@/lib/moderation";
import type { FormState } from "../actions";

// Tutor and coach side of Projects: write briefs, open or close them, and review submissions.

async function author() {
  const user = await getCurrentUser();
  if (!canEarn(user.roles)) redirect("/teach");
  return user;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function saveProject(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await author();
  const db = createAdminClient();
  const id = String(fd.get("id") ?? "");
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const brief = sanitizeRichText(String(fd.get("brief") ?? "").slice(0, 20000));
  const skills = String(fd.get("skills") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((s) => s.slice(0, 40));
  const level = ["beginner", "intermediate", "advanced"].includes(String(fd.get("level"))) ? String(fd.get("level")) : "beginner";
  const due = String(fd.get("due") ?? "");
  const courseId = String(fd.get("course_id") ?? "") || null;
  const status = fd.get("publish") === "1" ? "open" : undefined;

  if (title.length < 4) return { error: "Give the project a title of at least 4 characters." };
  if (brief.replace(/<[^>]+>/g, "").trim().length < 40) return { error: "Write a brief of at least a few sentences so learners know what to build." };
  if (courseId) {
    const { data: c } = await db.from("courses").select("instructor_id").eq("id", courseId).maybeSingle();
    if (c?.instructor_id !== user.id) return { error: "Pick one of your own courses, or leave it empty." };
  }
  const check = await moderate("project", user.id, [title, brief], id ? `/projects/${id}` : undefined);
  if (check.error) return { error: check.error };

  const row = { title, brief, skills, level, due_at: DAY.test(due) ? new Date(`${due}T23:59:00+01:00`).toISOString() : null, course_id: courseId, updated_at: new Date().toISOString(), ...(status ? { status } : {}) };
  if (id) {
    const { error } = await db.from("projects").update(row).eq("id", id).eq("author_id", user.id);
    if (error) return { error: "Could not save the project." };
    refresh();
    return { ok: status ? "Project published. Learners can now submit." : "Project saved." };
  }
  const { data, error } = await db.from("projects").insert({ ...row, author_id: user.id }).select("id").single();
  if (error || !data) return { error: "Could not create the project." };
  redirect(`/teach/projects/${data.id}`);
}

export async function setProjectStatus(fd: FormData) {
  const user = await author();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!["draft", "open", "closed"].includes(status)) return;
  await createAdminClient().from("projects").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("author_id", user.id);
  refresh();
}

export async function deleteProject(fd: FormData) {
  const user = await author();
  await createAdminClient().from("projects").delete().eq("id", String(fd.get("id") ?? "")).eq("author_id", user.id);
  redirect("/teach/projects");
}

// Feedback and featuring: only the brief's author can review its submissions.
export async function reviewSubmission(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await author();
  const db = createAdminClient();
  const id = String(fd.get("id") ?? "");
  const { data: sub } = await db.from("project_submissions").select("id, project_id").eq("id", id).maybeSingle();
  if (!sub) return { error: "That submission was not found." };
  const { data: project } = await db.from("projects").select("author_id").eq("id", sub.project_id).maybeSingle();
  if (project?.author_id !== user.id) return { error: "You can only review submissions to your own projects." };
  const feedback = String(fd.get("feedback") ?? "").trim().slice(0, 2000) || null;
  const action = String(fd.get("action") ?? "save");
  const status = action === "feature" ? "featured" : action === "hide" ? "hidden" : "reviewed";
  const { error } = await db.from("project_submissions").update({ feedback, status, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Could not save your review." };
  refresh();
  return { ok: status === "featured" ? "Featured in the showcase." : status === "hidden" ? "Submission hidden." : "Feedback saved." };
}
