"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Level = Database["public"]["Enums"]["course_level"];
type Status = Database["public"]["Enums"]["course_status"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const STATUSES: Status[] = ["draft", "published", "archived"];

export type FormState = { ok?: string; error?: string } | null;

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// Naira input ("15,000") to kobo.
function priceToMinor(input: string) {
  const n = Number(input.replace(/[^\d.]/g, "") || 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function safeUrl(input: string) {
  if (!input) return null;
  try {
    const u = new URL(input);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function createCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, userId } = await requireUserId();
  const title = str(fd, "title");
  if (title.length < 3) return { error: "Give your course a title of at least 3 characters." };
  const level = str(fd, "level") as Level;

  const base = slugify(title) || "course";
  let id: string | null = null;
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("courses")
      .insert({
        instructor_id: userId,
        title,
        slug,
        summary: str(fd, "summary") || null,
        level: LEVELS.includes(level) ? level : "beginner",
        price_minor: priceToMinor(str(fd, "price")),
      })
      .select("id")
      .single();
    if (data) id = data.id;
    else if (error?.code !== "23505") return { error: "Could not create the course. Check that your account can teach." };
  }
  if (!id) return { error: "Could not create a unique link for this course. Try a different title." };

  // Start every course with one module so lessons have somewhere to go.
  await supabase.from("course_modules").insert({ course_id: id, title: "Getting started", position: 0 });
  redirect(`/teach/courses/${id}`);
}

export async function updateCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, userId } = await requireUserId();
  const id = str(fd, "id");
  const title = str(fd, "title");
  const slug = slugify(str(fd, "slug"));
  const level = str(fd, "level") as Level;
  if (title.length < 3) return { error: "Title needs at least 3 characters." };
  if (!slug) return { error: "Add a URL slug." };

  const coverInput = str(fd, "cover_url");
  const cover = safeUrl(coverInput);
  if (coverInput && !cover) return { error: "Cover image must be a full http(s) URL." };

  const { error } = await supabase
    .from("courses")
    .update({
      title,
      slug,
      summary: str(fd, "summary") || null,
      description: str(fd, "description") || null,
      cover_url: cover,
      level: LEVELS.includes(level) ? level : "beginner",
      price_minor: priceToMinor(str(fd, "price")),
    })
    .eq("id", id)
    .eq("instructor_id", userId);
  if (error) return { error: error.code === "23505" ? "That URL slug is taken." : "Could not save changes." };
  refresh();
  return { ok: "Changes saved." };
}

export async function setCourseStatus(fd: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = str(fd, "id");
  const status = str(fd, "status") as Status;
  if (!STATUSES.includes(status)) return;
  await supabase
    .from("courses")
    .update({ status, ...(status === "published" ? { published_at: new Date().toISOString() } : {}) })
    .eq("id", id)
    .eq("instructor_id", userId);
  refresh();
}

export async function deleteCourse(fd: FormData) {
  const { supabase, userId } = await requireUserId();
  await supabase.from("courses").delete().eq("id", str(fd, "id")).eq("instructor_id", userId);
  redirect("/teach/courses");
}

export async function addModule(fd: FormData) {
  const { supabase } = await requireUserId();
  const courseId = str(fd, "courseId");
  const title = str(fd, "title");
  if (!title) return;
  const { count } = await supabase
    .from("course_modules")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  await supabase.from("course_modules").insert({ course_id: courseId, title, position: count ?? 0 });
  refresh();
}

export async function deleteModule(fd: FormData) {
  const { supabase } = await requireUserId();
  await supabase.from("course_modules").delete().eq("id", str(fd, "id"));
  refresh();
}

export async function addLesson(fd: FormData) {
  const { supabase } = await requireUserId();
  const moduleId = str(fd, "moduleId");
  const title = str(fd, "title");
  if (!title) return;
  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);
  // course_id is filled from the module by a database trigger.
  await supabase
    .from("lessons")
    .insert({ module_id: moduleId, course_id: str(fd, "courseId"), title, position: count ?? 0 });
  refresh();
}

export async function updateLesson(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireUserId();
  const title = str(fd, "title");
  if (!title) return { error: "Lesson title is required." };
  const videoInput = str(fd, "video_url");
  const video = safeUrl(videoInput);
  if (videoInput && !video) return { error: "Video must be a full http(s) URL." };
  const minutes = Number(str(fd, "minutes") || 0);

  const { error } = await supabase
    .from("lessons")
    .update({
      title,
      module_id: str(fd, "module_id"),
      content: str(fd, "content") || null,
      video_url: video,
      duration_seconds: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null,
      is_preview: fd.get("is_preview") === "on",
    })
    .eq("id", str(fd, "id"));
  if (error) return { error: "Could not save the lesson." };
  refresh();
  return { ok: "Lesson saved." };
}

export async function deleteLesson(fd: FormData) {
  const { supabase } = await requireUserId();
  await supabase.from("lessons").delete().eq("id", str(fd, "id"));
  const back = str(fd, "back");
  if (back.startsWith("/teach/")) redirect(back);
  refresh();
}
