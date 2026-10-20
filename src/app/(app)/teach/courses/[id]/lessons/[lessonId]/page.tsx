import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { getLessonForEditing } from "@/lib/data/teach";
import { deleteLesson, updateLesson } from "../../../../actions";
import { Select } from "@/components/dash/Select";

export const metadata = { title: "Edit lesson" };

export default async function LessonEditor({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const data = await getLessonForEditing(id, lessonId);
  if (!data) notFound();
  const { course, modules, lesson } = data;
  const back = `/teach/courses/${course.id}`;

  return (
    <div className="et-page">
      <Link href={back} className="et-back">
        <ArrowLeft size={14} />
        {course.title}
      </Link>
      <PageHead title="Edit lesson" />
      <section className="et-card et-card-pad">
        <ActionForm action={updateLesson}>
          <input type="hidden" name="id" value={lesson.id} />
          <div className="et-form-grid">
            <div className="et-field">
              <label htmlFor="title">Title</label>
              <input id="title" name="title" defaultValue={lesson.title} required />
            </div>
            <div className="et-field">
              <label htmlFor="module_id">Module</label>
              <Select id="module_id" name="module_id" defaultValue={lesson.module_id}>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="et-field">
              <label htmlFor="video_url">Video URL</label>
              <input id="video_url" name="video_url" type="url" defaultValue={lesson.video_url ?? ""} placeholder="YouTube, Vimeo, or a direct video link" />
            </div>
            <div className="et-field">
              <label htmlFor="minutes">Duration (minutes)</label>
              <input
                id="minutes"
                name="minutes"
                type="number"
                min={0}
                step="1"
                defaultValue={lesson.duration_seconds ? Math.round(lesson.duration_seconds / 60) : ""}
              />
            </div>
            <div className="et-field et-field-wide">
              <label htmlFor="content">Lesson notes</label>
              <textarea id="content" name="content" rows={12} defaultValue={lesson.content ?? ""} />
            </div>
          </div>
          <label className="et-check">
            <input type="checkbox" name="is_preview" defaultChecked={lesson.is_preview} />
            Free preview (visible before enrolling)
          </label>
          <div className="et-form-foot">
            <Link href={back} className="et-btn et-btn-ghost">
              Back to course
            </Link>
            <SubmitButton>Save lesson</SubmitButton>
          </div>
        </ActionForm>
      </section>
      <section className="et-card et-card-pad" style={{ display: "flex", justifyContent: "flex-end" }}>
        <form action={deleteLesson}>
          <input type="hidden" name="id" value={lesson.id} />
          <input type="hidden" name="back" value={back} />
          <button type="submit" className="et-btn et-btn-sm et-btn-danger-text">
            <Trash2 size={14} />
            Delete lesson
          </button>
        </form>
      </section>
    </div>
  );
}
