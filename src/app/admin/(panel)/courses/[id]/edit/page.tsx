import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getCourseCategories } from "@/lib/data/courses-admin";
import { keyFromUrl } from "@/lib/r2";
import { getInstructorOptions } from "../../instructors";
import { CourseWizard } from "../../new/CourseWizard";

export const metadata = { title: "Edit course" };

type Props = { params: Promise<{ id: string }> };

export default function EditCourse({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 560 }} />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: Props) {
  const { id } = await params;
  const { admin, db } = await requireAdmin("courses");
  const [{ data: course }, { data: modules }, { data: lessons }, { data: docs }, { count: students }, instructors, categories] = await Promise.all([
    db.from("courses").select("*, instructor:profiles!courses_instructor_id_fkey(full_name)").eq("id", id).maybeSingle(),
    db.from("course_modules").select("id, title, position").eq("course_id", id).order("position"),
    db.from("lessons").select("id, module_id, title, kind, video_url, content, position").eq("course_id", id).order("position"),
    db.from("documents").select("id, lesson_id, file_url, file_key, file_name, file_size, mime_type").eq("course_id", id).not("lesson_id", "is", null).order("created_at"),
    db.from("enrollments").select("user_id", { count: "exact", head: true }).eq("course_id", id),
    getInstructorOptions(db),
    getCourseCategories(),
  ]);
  if (!course) notFound();
  // Keep the current instructor selectable even if they're no longer a tutor.
  const options = instructors.some((i) => i.id === course.instructor_id) ? instructors : [{ id: course.instructor_id, label: course.instructor?.full_name || "Current instructor" }, ...instructors];

  return (
    <CourseWizard
      key={course.updated_at}
      instructors={options}
      categories={categories}
      defaultInstructor={admin.id}
      edit={{ courseId: course.id, status: course.status, students: students ?? 0 }}
      initial={{
        title: course.title,
        summary: course.summary ?? "",
        description: course.description ?? "",
        skills: (course.skills ?? []).join(", "),
        instructorId: course.instructor_id,
        categoryId: course.category_id ?? "",
        level: course.level,
        coverUrl: course.cover_url ?? "",
        priceNaira: course.price_minor / 100,
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
      }}
    />
  );
}
