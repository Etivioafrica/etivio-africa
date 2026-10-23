import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { keyFromUrl } from "@/lib/r2";
import type { WizardInitial } from "./new/CourseWizard";

// Loads a course into the course wizard's shape, for the admin and tutor edit pages.
export async function loadWizardCourse(id: string) {
  const db = createAdminClient();
  const [{ data: course }, { data: modules }, { data: lessons }, { data: docs }, { count: students }] = await Promise.all([
    db.from("courses").select("*, instructor:profiles!courses_instructor_id_fkey(full_name)").eq("id", id).maybeSingle(),
    db.from("course_modules").select("id, title, position").eq("course_id", id).order("position"),
    db.from("lessons").select("id, module_id, title, kind, video_url, content, position").eq("course_id", id).order("position"),
    db.from("documents").select("id, lesson_id, file_url, file_key, file_name, file_size, mime_type").eq("course_id", id).not("lesson_id", "is", null).order("created_at"),
    db.from("enrollments").select("user_id", { count: "exact", head: true }).eq("course_id", id),
  ]);
  if (!course) return null;
  const initial: WizardInitial = {
    title: course.title,
    summary: course.summary ?? "",
    description: course.description ?? "",
    skills: (course.skills ?? []).join(", "),
    instructorId: course.instructor_id,
    categoryId: course.category_id ?? "",
    level: course.level,
    coverUrl: course.cover_url ?? "",
    priceNaira: course.price_minor / 100,
    listed: course.marketplace_listed,
    group: { enabled: course.group_buy_enabled, size: course.group_size, discount: course.group_discount_percent, days: course.group_days },
    modules: (modules ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      lessons: (lessons ?? [])
        .filter((l) => l.module_id === m.id)
        .map((l) => ({
          id: l.id,
          title: l.title,
          videoUrl: l.video_url ?? "",
          // Uploaded to Etivio's storage rather than linked, so it shows as a file instead of a link field.
          hostedVideo: !!keyFromUrl(l.video_url),
          content: l.content ?? "",
          files: (docs ?? [])
            .filter((d) => d.lesson_id === l.id)
            .map((d) => ({ id: d.id, url: d.file_url, key: d.file_key ?? "", name: d.file_name ?? "File", size: d.file_size ?? 0, type: d.mime_type ?? "" })),
        })),
    })),
  };
  return { course, initial, students: students ?? 0 };
}
