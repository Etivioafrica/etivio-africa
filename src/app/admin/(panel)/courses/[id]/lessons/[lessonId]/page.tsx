import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { toHtml } from "@/lib/blog";
import { keyFromUrl } from "@/lib/r2";
import { LessonEditor } from "./LessonEditor";

export const metadata = { title: "Edit lesson" };

type Props = { params: Promise<{ id: string; lessonId: string }> };

export default function AdminLessonPage({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 640 }} />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: Props) {
  const { id, lessonId } = await params;
  const { db } = await requireAdmin("courses");
  const [{ data: course }, { data: lesson }, { data: modules }, { data: lessons }, { data: resources }] = await Promise.all([
    db.from("courses").select("id, title").eq("id", id).maybeSingle(),
    db.from("lessons").select("*").eq("id", lessonId).eq("course_id", id).maybeSingle(),
    db.from("course_modules").select("id, title, position").eq("course_id", id).order("position"),
    db.from("lessons").select("id, title, module_id, position").eq("course_id", id).order("position"),
    db.from("documents").select("id, title, file_url, file_name, file_size, mime_type").eq("lesson_id", lessonId).order("created_at"),
  ]);
  if (!course || !lesson) notFound();
  // Course order: by module position, then lesson position.
  const ordered = (modules ?? []).flatMap((m) => (lessons ?? []).filter((l) => l.module_id === m.id));
  const at = ordered.findIndex((l) => l.id === lesson.id);
  const nav = (i: number) => (ordered[i] ? { id: ordered[i].id, title: ordered[i].title } : null);

  return (
    <LessonEditor
      key={lesson.id}
      course={{ id: course.id, title: course.title }}
      modules={(modules ?? []).map((m) => ({ id: m.id, title: m.title }))}
      lesson={{
        id: lesson.id,
        title: lesson.title,
        moduleId: lesson.module_id,
        kind: lesson.kind === "reading" ? "reading" : "video",
        videoUrl: lesson.video_url ?? "",
        minutes: lesson.duration_seconds ? String(Math.round(lesson.duration_seconds / 60)) : "",
        content: toHtml(lesson.content),
        isPreview: lesson.is_preview,
      }}
      hostedVideo={keyFromUrl(lesson.video_url) !== null}
      resources={resources ?? []}
      position={{ index: at + 1, total: ordered.length, prev: nav(at - 1), next: nav(at + 1) }}
    />
  );
}
