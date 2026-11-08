import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Projects: practical briefs from tutors and coaches, learner submissions, and the public showcase.
// Read with the service role; every caller checks who is asking first.

export type Project = {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  courseId: string | null;
  courseTitle: string | null;
  title: string;
  brief: string;
  skills: string[];
  level: string;
  dueAt: string | null;
  status: "draft" | "open" | "closed";
  createdAt: string;
  submissions: number;
};

export type Submission = {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  username: string | null;
  avatar: string | null;
  title: string;
  summary: string;
  linkUrl: string | null;
  imageUrl: string | null;
  status: "submitted" | "reviewed" | "featured" | "hidden";
  feedback: string | null;
  createdAt: string;
};

const P_COLS = "id, author_id, course_id, title, brief, skills, level, due_at, status, created_at";
const S_COLS = "id, project_id, user_id, title, summary, link_url, image_url, status, feedback, created_at";

async function people(ids: string[]) {
  if (!ids.length) return new Map<string, { name: string; username: string | null; avatar: string | null }>();
  const { data } = await createAdminClient().from("profiles").select("id, full_name, username, avatar_url").in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((p) => [p.id, { name: p.full_name || "Etivio member", username: p.username, avatar: p.avatar_url }]));
}

type PRow = { id: string; author_id: string; course_id: string | null; title: string; brief: string; skills: string[]; level: string; due_at: string | null; status: string; created_at: string };

async function toProjects(rows: PRow[]): Promise<Project[]> {
  const db = createAdminClient();
  const ids = rows.map((r) => r.id);
  const courseIds = rows.map((r) => r.course_id).filter(Boolean) as string[];
  const [who, { data: courses }, { data: subs }] = await Promise.all([
    people(rows.map((r) => r.author_id)),
    courseIds.length ? db.from("courses").select("id, title").in("id", courseIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ids.length ? db.from("project_submissions").select("project_id").in("project_id", ids).neq("status", "hidden") : Promise.resolve({ data: [] as { project_id: string }[] }),
  ]);
  const titles = new Map((courses ?? []).map((c) => [c.id, c.title]));
  const counts = new Map<string, number>();
  for (const s of subs ?? []) counts.set(s.project_id, (counts.get(s.project_id) ?? 0) + 1);
  return rows.map((r) => ({
    id: r.id,
    authorId: r.author_id,
    authorName: who.get(r.author_id)?.name ?? "Tutor",
    authorUsername: who.get(r.author_id)?.username ?? null,
    courseId: r.course_id,
    courseTitle: r.course_id ? (titles.get(r.course_id) ?? null) : null,
    title: r.title,
    brief: r.brief,
    skills: r.skills ?? [],
    level: r.level,
    dueAt: r.due_at,
    status: r.status as Project["status"],
    createdAt: r.created_at,
    submissions: counts.get(r.id) ?? 0,
  }));
}

async function toSubmissions(rows: { id: string; project_id: string; user_id: string; title: string; summary: string; link_url: string | null; image_url: string | null; status: string; feedback: string | null; created_at: string }[]): Promise<Submission[]> {
  const who = await people(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    userId: r.user_id,
    name: who.get(r.user_id)?.name ?? "Learner",
    username: who.get(r.user_id)?.username ?? null,
    avatar: who.get(r.user_id)?.avatar ?? null,
    title: r.title,
    summary: r.summary,
    linkUrl: r.link_url,
    imageUrl: r.image_url,
    status: r.status as Submission["status"],
    feedback: r.feedback,
    createdAt: r.created_at,
  }));
}

export async function projectsByAuthor(authorId: string) {
  const { data } = await createAdminClient().from("projects").select(P_COLS).eq("author_id", authorId).order("updated_at", { ascending: false });
  return toProjects(data ?? []);
}

export async function openProjects(limit = 60) {
  const { data } = await createAdminClient().from("projects").select(P_COLS).eq("status", "open").order("created_at", { ascending: false }).limit(limit);
  return toProjects(data ?? []);
}

export async function getProject(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient().from("projects").select(P_COLS).eq("id", id).maybeSingle();
  return data ? (await toProjects([data]))[0] : null;
}

export async function submissionsFor(projectId: string, opts: { featuredOnly?: boolean } = {}) {
  let q = createAdminClient().from("project_submissions").select(S_COLS).eq("project_id", projectId).order("created_at", { ascending: false });
  q = opts.featuredOnly ? q.eq("status", "featured") : q.neq("status", "hidden");
  const { data } = await q;
  return toSubmissions(data ?? []);
}

export async function mySubmissions(userId: string) {
  const { data } = await createAdminClient().from("project_submissions").select(S_COLS).eq("user_id", userId).order("created_at", { ascending: false });
  return toSubmissions(data ?? []);
}

export async function featuredSubmissions(limit = 24) {
  const { data } = await createAdminClient().from("project_submissions").select(S_COLS).eq("status", "featured").order("reviewed_at", { ascending: false }).limit(limit);
  return toSubmissions(data ?? []);
}

export const LEVELS: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
