"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { deleteObject, keyFromUrl } from "@/lib/r2";
import { nairaToMinor, slugify } from "@/lib/format";
import type { Database } from "@/lib/database.types";
import type { FormState } from "@/app/(app)/teach/actions";

type Level = Database["public"]["Enums"]["course_level"];
type Status = Database["public"]["Enums"]["course_status"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const STATUSES: Status[] = ["draft", "published", "archived"];
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function safeUrl(input: string) {
  if (!input) return null;
  try {
    const u = new URL(input);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function adminCreateCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin();
  const title = str(fd, "title");
  const instructorId = str(fd, "instructor_id");
  if (title.length < 3) return { error: "Give the course a title of at least 3 characters." };
  if (!instructorId) return { error: "Pick an instructor." };
  const level = str(fd, "level") as Level;

  const base = slugify(title) || "course";
  let id: string | null = null;
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await db
      .from("courses")
      .insert({
        instructor_id: instructorId,
        title,
        slug,
        summary: str(fd, "summary") || null,
        cover_url: safeUrl(str(fd, "cover_url")),
        level: LEVELS.includes(level) ? level : "beginner",
        price_minor: nairaToMinor(str(fd, "price")),
      })
      .select("id")
      .single();
    if (data) id = data.id;
    else if (error?.code !== "23505") return { error: "Could not create the course." };
  }
  if (!id) return { error: "Could not create a unique link for this course. Try a different title." };
  await db.from("course_modules").insert({ course_id: id, title: "Getting started", position: 0 });
  await audit(admin.id, "course.create", { type: "course", id }, { title });
  redirect(`/admin/courses/${id}`);
}

export async function adminUpdateCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin();
  const id = str(fd, "id");
  const title = str(fd, "title");
  const slug = slugify(str(fd, "slug"));
  const level = str(fd, "level") as Level;
  if (title.length < 3) return { error: "Title needs at least 3 characters." };
  if (!slug) return { error: "Add a URL slug." };
  const coverInput = str(fd, "cover_url");
  const cover = safeUrl(coverInput);
  if (coverInput && !cover) return { error: "Cover image must be a full http(s) URL." };

  const { data: before } = await db.from("courses").select("cover_url").eq("id", id).single();
  const { error } = await db
    .from("courses")
    .update({
      title,
      slug,
      instructor_id: str(fd, "instructor_id") || undefined,
      summary: str(fd, "summary") || null,
      description: str(fd, "description") || null,
      cover_url: cover,
      level: LEVELS.includes(level) ? level : "beginner",
      price_minor: nairaToMinor(str(fd, "price")),
    })
    .eq("id", id);
  if (error) return { error: error.code === "23505" ? "That URL slug is taken." : "Could not save changes." };
  if (before?.cover_url && before.cover_url !== cover) await deleteObject(keyFromUrl(before.cover_url));
  await audit(admin.id, "course.update", { type: "course", id });
  refresh();
  return { ok: "Changes saved." };
}

export async function adminSetCourseStatus(fd: FormData) {
  const { admin, db } = await requireAdmin();
  const id = str(fd, "id");
  const status = str(fd, "status") as Status;
  if (!STATUSES.includes(status)) return;
  await db
    .from("courses")
    .update({ status, ...(status === "published" ? { published_at: new Date().toISOString() } : {}) })
    .eq("id", id);
  await audit(admin.id, `course.${status}`, { type: "course", id });
  refresh();
}

export async function adminDeleteCourse(fd: FormData) {
  const { admin, db } = await requireAdmin();
  const id = str(fd, "id");
  const { count } = await db.from("enrollments").select("user_id", { count: "exact", head: true }).eq("course_id", id);
  if (count) throw new Error("This course has students. Archive it instead.");
  const { data: course } = await db.from("courses").select("title, cover_url").eq("id", id).single();
  const { data: lessons } = await db.from("lessons").select("video_url").eq("course_id", id);
  await db.from("courses").delete().eq("id", id);
  await Promise.all([course?.cover_url, ...(lessons ?? []).map((l) => l.video_url)].map((u) => deleteObject(keyFromUrl(u ?? null))));
  await audit(admin.id, "course.delete", { type: "course", id }, { title: course?.title ?? "" });
  redirect("/admin/courses");
}

export async function adminAddModule(fd: FormData) {
  const { db } = await requireAdmin();
  const courseId = str(fd, "courseId");
  const title = str(fd, "title");
  if (!title) return;
  const { count } = await db.from("course_modules").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  await db.from("course_modules").insert({ course_id: courseId, title, position: count ?? 0 });
  refresh();
}

export async function adminDeleteModule(fd: FormData) {
  const { db } = await requireAdmin();
  await db.from("course_modules").delete().eq("id", str(fd, "id"));
  refresh();
}

export async function adminAddLesson(fd: FormData) {
  const { db } = await requireAdmin();
  const moduleId = str(fd, "moduleId");
  const title = str(fd, "title");
  if (!title) return;
  const { count } = await db.from("lessons").select("id", { count: "exact", head: true }).eq("module_id", moduleId);
  await db.from("lessons").insert({ module_id: moduleId, course_id: str(fd, "courseId"), title, position: count ?? 0 });
  refresh();
}

export async function adminUpdateLesson(_prev: FormState, fd: FormData): Promise<FormState> {
  const { db } = await requireAdmin();
  const id = str(fd, "id");
  const title = str(fd, "title");
  if (!title) return { error: "Lesson title is required." };
  // An uploaded file wins over a pasted link.
  const videoInput = str(fd, "video_file_url") || str(fd, "video_url");
  const video = safeUrl(videoInput);
  if (videoInput && !video) return { error: "Video must be a full http(s) URL." };
  const minutes = Number(str(fd, "minutes") || 0);

  const { data: before } = await db.from("lessons").select("video_url").eq("id", id).single();
  const { error } = await db
    .from("lessons")
    .update({
      title,
      module_id: str(fd, "module_id"),
      content: str(fd, "content") || null,
      video_url: video,
      duration_seconds: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null,
      is_preview: fd.get("is_preview") === "on",
    })
    .eq("id", id);
  if (error) return { error: "Could not save the lesson." };
  if (before?.video_url && before.video_url !== video) await deleteObject(keyFromUrl(before.video_url));
  refresh();
  return { ok: "Lesson saved." };
}

export async function adminDeleteLesson(fd: FormData) {
  const { db } = await requireAdmin();
  const { data: lesson } = await db.from("lessons").select("video_url").eq("id", str(fd, "id")).single();
  await db.from("lessons").delete().eq("id", str(fd, "id"));
  await deleteObject(keyFromUrl(lesson?.video_url ?? null));
  redirect(str(fd, "back").startsWith("/admin/") ? str(fd, "back") : "/admin/courses");
}
