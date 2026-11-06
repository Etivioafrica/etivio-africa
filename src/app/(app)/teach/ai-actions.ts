"use server";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai";
import { makeCover, writeCourseCopy, writeLessonNotes, writeOutline, writeProductCopy, writeProductDescription, type Outline } from "@/lib/ai-writer";
import { createAdminClient } from "@/lib/supabase/admin";
import { featureOn } from "@/lib/data/features";

// AI course tools for tutors (their own courses) and super admins (any course). Each use counts toward a daily
// limit and is logged in ai_messages.

const DAILY_LIMIT = 40;
// Each kind of action also has its own daily cap, so one button can't be pressed over and over. `label` reads in the error.
const KINDS = {
  outline: { limit: 5, label: "course outlines" },
  copy: { limit: 6, label: "summary and description rewrites" },
  cover: { limit: 6, label: "AI covers" },
  lesson: { limit: 30, label: "lesson note drafts" },
  product: { limit: 10, label: "product writing helps" },
} as const;
type Kind = keyof typeof KINDS;
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function gate(feature: "course_writer" | "thumbnail", kind: Kind, note: string, courseId?: string) {
  if (!aiConfigured()) return { error: "AI tools aren't available right now." } as const;
  if (!(await featureOn("ai_course_tools"))) return { error: "AI tools are turned off right now." } as const;
  const user = await getCurrentUser();
  const isAdmin = user.roles.includes("super_admin");
  if (!isAdmin && !user.roles.includes("tutor")) return { error: "AI tools are for tutors." } as const;
  const db = createAdminClient();
  if (courseId) {
    const { data: c } = await db.from("courses").select("instructor_id").eq("id", courseId).maybeSingle();
    if (!c || (!isAdmin && c.instructor_id !== user.id)) return { error: "That course wasn't found." } as const;
  }
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from("ai_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("feature", ["course_writer", "thumbnail"]).eq("role", "user").gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return { error: `You've used today's ${DAILY_LIMIT} AI actions. They reset in 24 hours.` } as const;
  const { limit, label } = KINDS[kind];
  const tag = `[${kind}] `;
  const { count: used } = await db.from("ai_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "user").like("content", `${tag}%`).gte("created_at", since);
  if ((used ?? 0) >= limit) return { error: `You've used today's ${limit} ${label}. Edit what you have, or try again in 24 hours.` } as const;
  await db.from("ai_messages").insert({ user_id: user.id, course_id: courseId ?? null, feature, role: "user", content: `${tag}${note}`.slice(0, 1000) });
  return { user, db, left: limit - (used ?? 0) - 1 } as const;
}

async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const msg = (e as Error).message;
    return { ok: false, error: msg.startsWith("The AI") || msg.startsWith("The image") ? msg : "The AI couldn't finish that just now. Try again in a moment." };
  }
}

// --- Used by the admin course wizard (results go into the form, the tutor/admin reviews before saving) ---

export async function aiOutline(input: { title: string; summary?: string; level: string; audience?: string; modules?: number; useWeb?: boolean }): Promise<Result<Outline>> {
  if (input.title.trim().length < 4) return { ok: false, error: "Give the course a title first." };
  const g = await gate("course_writer", "outline", `Outline: ${input.title}`);
  if ("error" in g) return { ok: false, error: g.error! };
  return attempt(() => writeOutline(input));
}

export async function aiCopy(input: { title: string; level: string; outline: string[] }) {
  if (input.title.trim().length < 4) return { ok: false as const, error: "Give the course a title first." };
  const g = await gate("course_writer", "copy", `Course copy: ${input.title}`);
  if ("error" in g) return { ok: false as const, error: g.error! };
  const res = await attempt(() => writeCourseCopy(input));
  return { ...res, left: g.left };
}

export async function aiLesson(input: { courseTitle: string; moduleTitle?: string; lessonTitle: string; level: string; existing?: string }) {
  if (input.lessonTitle.trim().length < 3) return { ok: false as const, error: "Give the lesson a title first." };
  const g = await gate("course_writer", "lesson", `Lesson notes: ${input.lessonTitle}`);
  if ("error" in g) return { ok: false as const, error: g.error! };
  return attempt(() => writeLessonNotes(input));
}

export async function aiProductCopy(input: { kind: string; title: string; formats?: string; notes?: string; items?: string[] }) {
  if (input.title.trim().length < 4) return { ok: false as const, error: "Give the product a title first." };
  const g = await gate("course_writer", "product", `Product copy: ${input.title}`);
  if ("error" in g) return { ok: false as const, error: g.error! };
  return attempt(() => writeProductCopy(input));
}

export async function aiProductDescription(input: { kind: string; title: string; summary?: string; formats?: string; existing?: string; items?: string[] }) {
  if (input.title.trim().length < 4) return { ok: false as const, error: "Give the product a title first." };
  const g = await gate("course_writer", "product", `Product description: ${input.title}`);
  if ("error" in g) return { ok: false as const, error: g.error! };
  return attempt(() => writeProductDescription(input));
}

export async function aiCover(input: { title: string; summary?: string; style?: string }) {
  if (input.title.trim().length < 4) return { ok: false as const, error: "Give the course a title first." };
  const g = await gate("thumbnail", "cover", `Cover: ${input.title}`);
  if ("error" in g) return { ok: false as const, error: g.error! };
  const res = await attempt(() => makeCover(input));
  return { ...res, left: g.left };
}

// --- Used by the tutor course editor (writes straight to the course) ---

export async function aiFillCourse(courseId: string, what: "outline" | "copy" | "cover", options: { useWeb?: boolean; style?: string } = {}): Promise<Result<string>> {
  const g = await gate(what === "cover" ? "thumbnail" : "course_writer", what === "cover" ? "cover" : what, `${what}: course ${courseId}`, courseId);
  if ("error" in g) return { ok: false, error: g.error! };
  const { db } = g;
  const { data: c } = await db.from("courses").select("id, title, summary, level").eq("id", courseId).maybeSingle();
  if (!c) return { ok: false, error: "That course wasn't found." };

  if (what === "outline") {
    const { count } = await db.from("course_modules").select("id", { count: "exact", head: true }).eq("course_id", courseId);
    if (count) return { ok: false, error: "This course already has modules. The outline generator is for empty courses." };
    const res = await attempt(() => writeOutline({ title: c.title, summary: c.summary ?? "", level: c.level, useWeb: options.useWeb }));
    if (!res.ok) return res;
    for (const [mi, m] of res.data.modules.entries()) {
      const { data: mod } = await db.from("course_modules").insert({ course_id: courseId, title: m.title, position: mi }).select("id").single();
      if (!mod) continue;
      await db.from("lessons").insert(m.lessons.map((l, li) => ({ course_id: courseId, module_id: mod.id, title: l.title, content: l.summary ? `<p>${l.summary.replace(/</g, "&lt;")}</p>` : null, position: li, kind: "reading" as const })));
    }
    refresh();
    return { ok: true, data: `Added ${res.data.modules.length} modules. Open each lesson to add your video or notes.` };
  }

  if (what === "copy") {
    const { data: lessons } = await db.from("lessons").select("title").eq("course_id", courseId).order("position");
    const res = await attempt(() => writeCourseCopy({ title: c.title, level: c.level, outline: (lessons ?? []).map((l) => l.title) }));
    if (!res.ok) return res;
    await db.from("courses").update({ summary: res.data.summary, description: res.data.description, ...(res.data.skills.length ? { skills: res.data.skills } : {}) }).eq("id", courseId);
    refresh();
    return { ok: true, data: `Summary, description and skills written. Check them below and edit anything that isn't right. ${g.left} rewrite${g.left === 1 ? "" : "s"} left today.` };
  }

  const res = await attempt(() => makeCover({ title: c.title, summary: c.summary ?? "", style: options.style }));
  if (!res.ok) return res;
  await db.from("courses").update({ cover_url: res.data }).eq("id", courseId);
  refresh();
  return { ok: true, data: `New cover added. ${g.left} AI cover${g.left === 1 ? "" : "s"} left today.` };
}
