"use server";
import { redirect } from "next/navigation";
import { parseSkills } from "@/lib/skills";
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
  const { data: lessons } = await db.from("lessons").select("video_url").eq("course_id", id);
  await db.from("courses").delete().eq("id", id);
  await Promise.all([course?.cover_url, ...(lessons ?? []).map((l) => l.video_url)].map((u) => deleteObject(keyFromUrl(u ?? null))));
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
  instructorId: string;
  categoryId: string;
  level: Level;
  coverUrl: string;
  priceNaira: string;
  modules: { title: string; lessons: string[] }[];
  publish: boolean;
};

export async function createCourseFull(input: NewCourseInput): Promise<Result> {
  const { admin, db } = await requireAdmin("courses");
  const title = input.title.trim().slice(0, 140);
  if (title.length < 3) return { error: "Give the course a title of at least 3 characters." };
  if (!input.instructorId) return { error: "Pick an instructor." };
  const modules = input.modules
    .map((m) => ({ title: m.title.trim().slice(0, 140), lessons: m.lessons.map((l) => l.trim().slice(0, 160)).filter(Boolean) }))
    .filter((m) => m.title);
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

  const list = modules.length ? modules : [{ title: "Getting started", lessons: [] }];
  for (const [mi, m] of list.entries()) {
    const { data: mod } = await db.from("course_modules").insert({ course_id: id, title: m.title, position: mi }).select("id").single();
    if (mod && m.lessons.length) await db.from("lessons").insert(m.lessons.map((l, li) => ({ module_id: mod.id, course_id: id, title: l, position: li })));
  }
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
