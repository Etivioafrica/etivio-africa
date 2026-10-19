"use server";
import { redirect } from "next/navigation";
import { parseSkills } from "@/lib/skills";
import { refresh } from "next/cache";
import { after } from "next/server";
import { emailReviewReply } from "@/lib/email/notify";
import { audit, requireAdmin } from "@/lib/admin";
import { deleteObject, keyFromUrl } from "@/lib/r2";
import { nairaToMinor, slugify } from "@/lib/format";
import { sanitizeRichText } from "@/lib/sanitize";
import type { Database } from "@/lib/database.types";
import type { FormState } from "@/app/(app)/teach/actions";

type Level = Database["public"]["Enums"]["course_level"];
type Status = Database["public"]["Enums"]["course_status"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const STATUSES: Status[] = ["draft", "published", "archived"];
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
type Result = { ok?: string; error?: string; id?: string };
type DB = Awaited<ReturnType<typeof requireAdmin>>["db"];

// category_id plus the main category's name in `category`, which recommendations match against learner interests.
async function categoryColumns(db: DB, id: string) {
  if (!id) return { category_id: null, category: null };
  const { data: cat } = await db.from("course_categories").select("id, name, parent_id").eq("id", id).maybeSingle();
  if (!cat) return { category_id: null, category: null };
  const parent = cat.parent_id ? (await db.from("course_categories").select("name").eq("id", cat.parent_id).maybeSingle()).data : null;
  return { category_id: cat.id, category: parent?.name ?? cat.name };
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

export async function adminCreateCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("courses");
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
  const { admin, db } = await requireAdmin("courses");
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
      skills: parseSkills(str(fd, "skills")),
      ...(await categoryColumns(db, str(fd, "category_id"))),
      level: LEVELS.includes(level) ? level : "beginner",
      // Price lives on the Pricing tab; only touch it when this form sends one.
      ...(fd.has("price") ? { price_minor: nairaToMinor(str(fd, "price")) } : {}),
    })
    .eq("id", id);
  if (error) return { error: error.code === "23505" ? "That URL slug is taken." : "Could not save changes." };
  if (before?.cover_url && before.cover_url !== cover) await deleteObject(keyFromUrl(before.cover_url));
  await audit(admin.id, "course.update", { type: "course", id });
  refresh();
  return { ok: "Changes saved." };
}

export async function adminSetCourseStatus(fd: FormData) {
  const { admin, db } = await requireAdmin("courses");
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
  const { admin, db } = await requireAdmin("courses");
  const id = str(fd, "id");
  const { count } = await db.from("enrollments").select("user_id", { count: "exact", head: true }).eq("course_id", id);
  if (count) throw new Error("This course has students. Archive it instead.");
  const { data: course } = await db.from("courses").select("title, cover_url").eq("id", id).single();
  const [{ data: lessons }, { data: docs }] = await Promise.all([
    db.from("lessons").select("video_url").eq("course_id", id),
    db.from("documents").select("file_url").eq("course_id", id).not("lesson_id", "is", null),
  ]);
  await db.from("courses").delete().eq("id", id);
  await Promise.all(
    [course?.cover_url, ...(lessons ?? []).map((l) => l.video_url), ...(docs ?? []).map((d) => d.file_url)].map((u) => deleteObject(keyFromUrl(u ?? null))),
  );
  await audit(admin.id, "course.delete", { type: "course", id }, { title: course?.title ?? "" });
  redirect("/admin/courses");
}

export async function adminAddModule(fd: FormData) {
  const { db } = await requireAdmin("courses");
  const courseId = str(fd, "courseId");
  const title = str(fd, "title");
  if (!title) return;
  const { count } = await db.from("course_modules").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  await db.from("course_modules").insert({ course_id: courseId, title, position: count ?? 0 });
  refresh();
}

export async function adminDeleteModule(fd: FormData) {
  const { db } = await requireAdmin("courses");
  await db.from("course_modules").delete().eq("id", str(fd, "id"));
  refresh();
}

export async function adminAddLesson(fd: FormData) {
  const { db } = await requireAdmin("courses");
  const moduleId = str(fd, "moduleId");
  const title = str(fd, "title");
  if (!title) return;
  const { count } = await db.from("lessons").select("id", { count: "exact", head: true }).eq("module_id", moduleId);
  await db.from("lessons").insert({ module_id: moduleId, course_id: str(fd, "courseId"), title, position: count ?? 0 });
  refresh();
}

export async function adminUpdateLesson(_prev: FormState, fd: FormData): Promise<FormState> {
  const { db } = await requireAdmin("courses");
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
  const { db } = await requireAdmin("courses");
  const { data: lesson } = await db.from("lessons").select("video_url").eq("id", str(fd, "id")).single();
  await db.from("lessons").delete().eq("id", str(fd, "id"));
  await deleteObject(keyFromUrl(lesson?.video_url ?? null));
  redirect(str(fd, "back").startsWith("/admin/") ? str(fd, "back") : "/admin/courses");
}

// New-course wizard --------------------------------------------------------------------

export type NewCourseInput = {
  title: string;
  summary: string;
  description: string;
  skills: string;
  instructorId: string;
  categoryId: string;
  level: Level;
  coverUrl: string;
  priceNaira: string;
  modules: ModuleDraft[];
  publish: boolean;
};

export type LessonFile = { id?: string; url: string; key: string; name: string; size: number; type: string };
export type LessonDraft = { id?: string; key?: string; title: string; videoUrl: string; content: string; files: LessonFile[] };
export type ModuleDraft = { id?: string; key?: string; title: string; lessons: LessonDraft[] };
// Ids for rows a save created, keyed the way the editor knows them, so the next autosave updates instead of re-adding.
export type Created = { lessons: Record<string, string>; modules: Record<string, string>; files: Record<string, string> };

// Trims titles, drops empty rows and checks video links. Returns an error message for the first bad lesson.
function cleanCurriculum(input: ModuleDraft[]) {
  const modules = input
    .map((m) => ({
      ...m,
      title: m.title.trim().slice(0, 140),
      lessons: m.lessons
        .map((l) => {
          const content = sanitizeRichText(l.content ?? "");
          return {
            ...l,
            title: l.title.trim().slice(0, 160),
            video: l.videoUrl.trim() ? safeUrl(l.videoUrl.trim()) : null,
            badVideo: !!l.videoUrl.trim() && !safeUrl(l.videoUrl.trim()),
            content: content.replace(/<p><\/p>/g, "").trim() ? content : null,
            files: (l.files ?? []).filter((f) => keyFromUrl(f.url)).slice(0, 20),
          };
        })
        .filter((l) => l.title),
    }))
    .filter((m) => m.title);
  const bad = modules.flatMap((m) => m.lessons).find((l) => l.badVideo);
  return { modules, error: bad ? `"${bad.title}": the video link must be a full https:// address.` : null };
}

// Writes the outline plus each lesson's video, text and files. Rows keep their ids, so progress, notes and quiz
// results survive renames and moves; anything missing from the outline is deleted along with its stored files.
async function syncCurriculum(db: DB, adminId: string, courseId: string, modules: ReturnType<typeof cleanCurriculum>["modules"]) {
  const [{ data: oldMods }, { data: oldLessons }, { data: oldDocs }] = await Promise.all([
    db.from("course_modules").select("id").eq("course_id", courseId),
    db.from("lessons").select("id, video_url").eq("course_id", courseId),
    db.from("documents").select("id, lesson_id, file_url").eq("course_id", courseId).not("lesson_id", "is", null),
  ]);
  const modIds = new Set((oldMods ?? []).map((m) => m.id));
  const lessonsById = new Map((oldLessons ?? []).map((l) => [l.id, l]));
  const keptMods = new Set<string>();
  const keptLessons = new Set<string>();
  const created: Created = { lessons: {}, modules: {}, files: {} };
  const trash: (string | null)[] = [];

  for (const [mi, m] of modules.entries()) {
    let moduleId = m.id && modIds.has(m.id) ? m.id : null;
    if (moduleId) await db.from("course_modules").update({ title: m.title, position: mi }).eq("id", moduleId);
    else {
      moduleId = (await db.from("course_modules").insert({ course_id: courseId, title: m.title, position: mi }).select("id").single()).data?.id ?? null;
      if (moduleId && m.key) created.modules[m.key] = moduleId;
    }
    if (!moduleId) return { error: "Could not save a module. Try again." };
    keptMods.add(moduleId);

    for (const [li, l] of m.lessons.entries()) {
      const fields = { title: l.title, module_id: moduleId, position: li, kind: l.video ? ("video" as const) : ("reading" as const), video_url: l.video, content: l.content };
      const old = l.id ? lessonsById.get(l.id) : undefined;
      let lessonId: string;
      if (old) {
        await db.from("lessons").update(fields).eq("id", old.id);
        if (old.video_url && old.video_url !== l.video) trash.push(old.video_url);
        lessonId = old.id;
      } else {
        const { data: row } = await db.from("lessons").insert({ ...fields, course_id: courseId }).select("id").single();
        if (!row) return { error: `Could not save "${l.title}". Try again.` };
        lessonId = row.id;
        if (l.key) created.lessons[l.key] = row.id;
      }
      keptLessons.add(lessonId);

      const keepDocs = new Set(l.files.map((f) => f.id).filter(Boolean));
      const gone = (oldDocs ?? []).filter((d) => d.lesson_id === lessonId && !keepDocs.has(d.id));
      if (gone.length) {
        await db.from("documents").delete().in("id", gone.map((d) => d.id));
        trash.push(...gone.map((d) => d.file_url));
      }
      const fresh = l.files.filter((f) => !f.id);
      if (fresh.length) {
        const { data: added } = await db.from("documents").insert(
          fresh.map((f) => ({
            title: f.name.slice(0, 160) || "File",
            file_url: f.url,
            file_key: f.key || keyFromUrl(f.url),
            file_name: f.name.slice(0, 200),
            file_size: f.size,
            mime_type: f.type.slice(0, 120),
            course_id: courseId,
            lesson_id: lessonId,
            visibility: "enrolled" as const,
            uploaded_by: adminId,
          })),
        ).select("id, file_url");
        for (const d of added ?? []) created.files[d.file_url] = d.id;
      }
    }
  }

  const dropLessons = (oldLessons ?? []).filter((l) => !keptLessons.has(l.id));
  if (dropLessons.length) {
    const dropped = new Set(dropLessons.map((l) => l.id));
    trash.push(...dropLessons.map((l) => l.video_url), ...(oldDocs ?? []).filter((d) => d.lesson_id && dropped.has(d.lesson_id)).map((d) => d.file_url));
    await db.from("lessons").delete().in("id", [...dropped]);
  }
  const dropMods = [...modIds].filter((id) => !keptMods.has(id));
  if (dropMods.length) await db.from("course_modules").delete().in("id", dropMods);
  await Promise.all(trash.map((u) => deleteObject(keyFromUrl(u))));
  return { created };
}

// A file uploaded in the wizard but removed before saving. Only deletes it if nothing points at it yet.
export async function discardUpload(url: string): Promise<Result> {
  const { db } = await requireAdmin("courses");
  const key = keyFromUrl(url);
  if (!key?.startsWith("documents/")) return {};
  const { count } = await db.from("documents").select("id", { count: "exact", head: true }).eq("file_url", url);
  if (!count) await deleteObject(key);
  return {};
}

export async function createCourseFull(input: NewCourseInput): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  const title = input.title.trim().slice(0, 140);
  if (title.length < 3) return { error: "Give the course a title of at least 3 characters." };
  if (!input.instructorId) return { error: "Pick an instructor." };
  const { modules, error: curriculumError } = cleanCurriculum(input.modules);
  if (curriculumError) return { error: curriculumError };
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);
  if (input.publish && !lessonCount) return { error: "Add at least one lesson before publishing." };

  const base = slugify(title) || "course";
  let id: string | null = null;
  for (let attempt = 0; attempt < 4 && !id; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await db
      .from("courses")
      .insert({
        instructor_id: input.instructorId,
        title,
        slug,
        summary: input.summary.trim().slice(0, 300) || null,
        description: input.description.trim().slice(0, 5000) || null,
        skills: parseSkills(input.skills),
        cover_url: safeUrl(input.coverUrl),
        level: LEVELS.includes(input.level) ? input.level : "beginner",
        price_minor: nairaToMinor(input.priceNaira),
        ...(await categoryColumns(db, input.categoryId)),
        ...(input.publish ? { status: "published" as const, published_at: new Date().toISOString() } : {}),
      })
      .select("id")
      .single();
    if (data) id = data.id;
    else if (error?.code !== "23505") return { error: "Could not create the course." };
  }
  if (!id) return { error: "Could not create a unique link for this course. Try a different title." };

  const synced = await syncCurriculum(db, admin.id, id, modules.length ? modules : [{ title: "Getting started", lessons: [] }]);
  if ("error" in synced) return { error: synced.error, id };
  await audit(admin.id, "course.create", { type: "course", id }, { title });
  refresh();
  return { ok: "Course created.", id };
}

// List actions ------------------------------------------------------------------------

export async function setCourseStatus(id: string, status: Status): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  if (!STATUSES.includes(status)) return { error: "Unknown status." };
  if (status === "published") {
    const { count } = await db.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", id);
    if (!count) return { error: "Add at least one lesson before publishing." };
  }
  await db
    .from("courses")
    .update({ status, ...(status === "published" ? { published_at: new Date().toISOString() } : { featured: false }) })
    .eq("id", id);
  await audit(admin.id, `course.${status}`, { type: "course", id });
  refresh();
  return { ok: status === "published" ? "Published." : status === "draft" ? "Moved to draft." : "Archived." };
}

export async function setCourseFeatured(id: string, featured: boolean): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  await db.from("courses").update({ featured }).eq("id", id);
  await audit(admin.id, featured ? "course.feature" : "course.unfeature", { type: "course", id });
  refresh();
  return { ok: featured ? "Featured on the homepage." : "Removed from featured." };
}

export async function adminUpdatePricing(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("courses");
  const id = str(fd, "id");
  const free = str(fd, "mode") === "free";
  const price = free ? 0 : nairaToMinor(str(fd, "price"));
  if (!free && price < 50000) return { error: "Paid courses need a price of at least ₦500." };
  const { error } = await db.from("courses").update({ price_minor: price }).eq("id", id);
  if (error) return { error: "Could not save the price." };
  await audit(admin.id, "course.price", { type: "course", id }, { price_minor: price });
  refresh();
  return { ok: free ? "This course is now free." : "Price saved." };
}

// Categories ----------------------------------------------------------------------------

export async function addCourseCategory(name: string, parentId: string | null): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  const clean = name.trim().slice(0, 60);
  if (!clean) return { error: "Type a name first." };
  const base = slugify(clean) || "category";
  const { data: taken } = await db.from("course_categories").select("slug").like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((t) => t.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
  const { data, error } = await db.from("course_categories").insert({ name: clean, slug, parent_id: parentId }).select("id").single();
  if (error || !data) return { error: "Could not add the category." };
  await audit(admin.id, "course.category_add", { type: "course_category", id: data.id }, { name: clean });
  refresh();
  return { ok: "Added.", id: data.id };
}

export async function deleteCourseCategory(id: string): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  await db.from("course_categories").delete().eq("id", id);
  await audit(admin.id, "course.category_delete", { type: "course_category", id });
  refresh();
  return { ok: "Deleted." };
}

// Reviews -------------------------------------------------------------------------------

export async function approveReview(id: string, approved: boolean): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  const { error } = await db.from("course_reviews").update({ approved }).eq("id", id);
  if (error) return { error: "Could not update the review." };
  await audit(admin.id, approved ? "review.approve" : "review.hide", { type: "course_review", id });
  refresh();
  return { ok: approved ? "Approved. It now shows on the course." : "Hidden." };
}

export async function replyToReview(id: string, reply: string): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  const text = reply.trim().slice(0, 2000);
  const { error } = await db
    .from("course_reviews")
    .update(text ? { admin_reply: text, replied_at: new Date().toISOString(), approved: true } : { admin_reply: null, replied_at: null })
    .eq("id", id);
  if (error) return { error: "Could not save the reply." };
  await audit(admin.id, "review.reply", { type: "course_review", id });
  if (text) after(() => emailReviewReply(id));
  refresh();
  return { ok: text ? "Reply posted." : "Reply removed." };
}

export async function deleteReview(id: string): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  await db.from("course_reviews").delete().eq("id", id);
  await audit(admin.id, "review.delete", { type: "course_review", id });
  refresh();
  return { ok: "Deleted." };
}

// Certificates ----------------------------------------------------------------------------

export async function revokeCertificate(code: string, reason: string): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  const why = reason.trim().slice(0, 300);
  if (!why) return { error: "Say why you're revoking it. The reason shows on the verify page." };
  const { error } = await db.from("certificates").update({ revoked_at: new Date().toISOString(), revoked_reason: why }).eq("code", code);
  if (error) return { error: "Could not revoke the certificate." };
  await audit(admin.id, "certificate.revoke", { type: "certificate", id: code }, { reason: why });
  refresh();
  return { ok: "Certificate revoked." };
}

export async function restoreCertificate(code: string): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  await db.from("certificates").update({ revoked_at: null, revoked_reason: null }).eq("code", code);
  await audit(admin.id, "certificate.restore", { type: "certificate", id: code });
  refresh();
  return { ok: "Certificate restored." };
}

// Quizzes ---------------------------------------------------------------------------------

export type QuizQuestionInput = { prompt: string; options: string[]; correct: number; explanation: string };

export async function createQuiz(moduleId: string): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  const { data: mod } = await db.from("course_modules").select("id, course_id, title").eq("id", moduleId).maybeSingle();
  if (!mod) return { error: "That module no longer exists." };
  const { data, error } = await db
    .from("course_quizzes")
    .insert({ course_id: mod.course_id, module_id: mod.id, title: `${mod.title} quiz`.slice(0, 120) })
    .select("id")
    .single();
  if (error || !data) return { error: error?.code === "23505" ? "This module already has a quiz." : "Could not add the quiz." };
  await audit(admin.id, "quiz.create", { type: "quiz", id: data.id });
  refresh();
  return { ok: "Quiz added.", id: data.id };
}

export async function saveQuiz(quizId: string, input: { title: string; passMark: number; questions: QuizQuestionInput[] }): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  const title = input.title.trim().slice(0, 120);
  if (!title) return { error: "Give the quiz a title." };
  const passMark = Math.min(100, Math.max(1, Math.round(input.passMark || 70)));
  const questions = input.questions.map((q) => ({ ...q, prompt: q.prompt.trim(), options: q.options.map((o) => o.trim()) }));
  for (const [i, q] of questions.entries()) {
    const n = i + 1;
    if (!q.prompt) return { error: `Question ${n} needs a question.` };
    if (q.options.length < 2 || q.options.some((o) => !o)) return { error: `Question ${n} needs at least two answers, and none can be empty.` };
    if (q.options.length > 6) return { error: `Question ${n} can have at most six answers.` };
    if (q.correct < 0 || q.correct >= q.options.length) return { error: `Pick the right answer for question ${n}.` };
  }
  const { error } = await db.from("course_quizzes").update({ title, pass_mark: passMark }).eq("id", quizId);
  if (error) return { error: "Could not save the quiz." };
  await db.from("quiz_questions").delete().eq("quiz_id", quizId);
  if (questions.length) {
    const { error: qErr } = await db.from("quiz_questions").insert(
      questions.map((q, i) => ({
        quiz_id: quizId,
        position: i,
        prompt: q.prompt.slice(0, 500),
        options: q.options.map((o) => o.slice(0, 200)),
        correct_index: q.correct,
        explanation: q.explanation.trim().slice(0, 1000) || null,
      })),
    );
    if (qErr) return { error: "Could not save the questions." };
  }
  await audit(admin.id, "quiz.save", { type: "quiz", id: quizId }, { questions: questions.length });
  refresh();
  return { ok: "Quiz saved." };
}

export async function deleteQuiz(quizId: string): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  await db.from("course_quizzes").delete().eq("id", quizId);
  await audit(admin.id, "quiz.delete", { type: "quiz", id: quizId });
  refresh();
  return { ok: "Quiz deleted." };
}

// Edit course (same four steps as creating one) ---------------------------------------------

// `quiet` is for autosave: skip refreshing the page so the editor isn't re-rendered mid-typing.
export type EditCourseInput = Omit<NewCourseInput, "publish"> & { status: "keep" | "draft" | "published"; quiet?: boolean };

// Saves details, pricing and the curriculum outline in one go. Modules and lessons keep their ids, so
// progress, notes and quiz results survive renames and moves; anything removed from the outline is deleted.
export async function updateCourseFull(courseId: string, input: EditCourseInput): Promise<Result & { created?: Created }> {
  const { admin, db } = await requireAdmin("courses");
  const title = input.title.trim().slice(0, 140);
  if (title.length < 3) return { error: "Give the course a title of at least 3 characters." };
  if (!input.instructorId) return { error: "Pick an instructor." };
  const { data: before } = await db.from("courses").select("cover_url, status").eq("id", courseId).maybeSingle();
  if (!before) return { error: "That course no longer exists." };

  const { modules, error: curriculumError } = cleanCurriculum(input.modules);
  if (curriculumError) return { error: curriculumError };
  if (!modules.length) return { error: "Keep at least one module." };
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);
  const nextStatus = input.status === "keep" ? before.status : input.status;
  if (nextStatus === "published" && !lessonCount) return { error: "A published course needs at least one lesson." };

  const cover = safeUrl(input.coverUrl);
  const { error } = await db
    .from("courses")
    .update({
      title,
      summary: input.summary.trim().slice(0, 300) || null,
      description: input.description.trim().slice(0, 5000) || null,
      skills: parseSkills(input.skills),
      instructor_id: input.instructorId,
      cover_url: cover,
      level: LEVELS.includes(input.level) ? input.level : "beginner",
      price_minor: nairaToMinor(input.priceNaira),
      ...(await categoryColumns(db, input.categoryId)),
      ...(nextStatus !== before.status ? { status: nextStatus, ...(nextStatus === "published" ? { published_at: new Date().toISOString() } : { featured: false }) } : {}),
    })
    .eq("id", courseId);
  if (error) return { error: "Could not save the course." };

  const synced = await syncCurriculum(db, admin.id, courseId, modules);
  if ("error" in synced) return { error: synced.error };
  if (before.cover_url && before.cover_url !== cover) await deleteObject(keyFromUrl(before.cover_url));

  if (!input.quiet) {
    await audit(admin.id, "course.update", { type: "course", id: courseId }, { lessons: lessonCount });
    refresh();
  }
  return { ok: "Course saved.", id: courseId, created: synced.created };
}

// Lesson editor -----------------------------------------------------------------------------

export type LessonInput = { title: string; moduleId: string; kind: "video" | "reading"; videoUrl: string; minutes: string; content: string; isPreview: boolean };

export async function saveLessonFull(lessonId: string, input: LessonInput): Promise<Result> {
  const { db } = await requireAdmin("courses");
  const title = input.title.trim().slice(0, 160);
  if (!title) return { error: "Give the lesson a title." };
  const video = input.kind === "video" ? safeUrl(input.videoUrl.trim()) : null;
  if (input.kind === "video" && input.videoUrl.trim() && !video) return { error: "The video link must be a full https:// address." };
  const minutes = Number(input.minutes || 0);
  const { data: before } = await db.from("lessons").select("video_url, course_id").eq("id", lessonId).maybeSingle();
  if (!before) return { error: "That lesson no longer exists." };
  const { data: mod } = await db.from("course_modules").select("id").eq("id", input.moduleId).eq("course_id", before.course_id).maybeSingle();
  if (!mod) return { error: "Pick a module from this course." };
  const content = sanitizeRichText(input.content);
  const { error } = await db
    .from("lessons")
    .update({
      title,
      module_id: mod.id,
      kind: input.kind,
      video_url: video,
      content: content.replace(/<p><\/p>/g, "").trim() ? content : null,
      duration_seconds: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null,
      is_preview: input.isPreview,
    })
    .eq("id", lessonId);
  if (error) return { error: "Could not save the lesson." };
  if (before.video_url && before.video_url !== video) await deleteObject(keyFromUrl(before.video_url));
  refresh();
  return { ok: "Lesson saved." };
}

export async function addLessonResource(lessonId: string, file: { url: string; key: string; name: string; size: number; type: string }, title: string): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  const { data: lesson } = await db.from("lessons").select("course_id").eq("id", lessonId).maybeSingle();
  if (!lesson) return { error: "That lesson no longer exists." };
  if (!keyFromUrl(file.url)) return { error: "Upload the file first." };
  const { data, error } = await db
    .from("documents")
    .insert({
      title: (title.trim() || file.name).slice(0, 160),
      file_url: file.url,
      file_key: file.key || keyFromUrl(file.url),
      file_name: file.name.slice(0, 200),
      file_size: file.size,
      mime_type: file.type.slice(0, 120),
      course_id: lesson.course_id,
      lesson_id: lessonId,
      visibility: "enrolled",
      uploaded_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not attach the file." };
  refresh();
  return { ok: "Resource added.", id: data.id };
}

export async function removeLessonResource(docId: string): Promise<Result> {
  const { db } = await requireAdmin("courses");
  const { data } = await db.from("documents").select("file_url").eq("id", docId).maybeSingle();
  await db.from("documents").delete().eq("id", docId);
  await deleteObject(keyFromUrl(data?.file_url ?? null));
  refresh();
  return { ok: "Resource removed." };
}

export async function adminUpdateSlug(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("courses");
  const id = str(fd, "id");
  const slug = slugify(str(fd, "slug"));
  if (!slug) return { error: "Add a URL slug." };
  const { error } = await db.from("courses").update({ slug }).eq("id", id);
  if (error) return { error: error.code === "23505" ? "That link is already used by another course." : "Could not save the link." };
  await audit(admin.id, "course.slug", { type: "course", id }, { slug });
  refresh();
  return { ok: "Link saved." };
}

export async function deleteLessonFromEditor(lessonId: string): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  const [{ data: lesson }, { data: docs }] = await Promise.all([
    db.from("lessons").select("video_url, course_id").eq("id", lessonId).maybeSingle(),
    db.from("documents").select("file_url").eq("lesson_id", lessonId),
  ]);
  if (!lesson) return { error: "That lesson no longer exists." };
  await db.from("lessons").delete().eq("id", lessonId);
  await Promise.all([lesson.video_url, ...(docs ?? []).map((d) => d.file_url)].map((u) => deleteObject(keyFromUrl(u ?? null))));
  await audit(admin.id, "lesson.delete", { type: "lesson", id: lessonId });
  refresh();
  return { ok: "Lesson deleted." };
}
