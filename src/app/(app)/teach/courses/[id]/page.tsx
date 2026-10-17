import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, FileText, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { Status } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { getCourseForEditing } from "@/lib/data/teach";
import { formatDuration } from "@/lib/format";
import { addLesson, addModule, deleteCourse, deleteModule, setCourseStatus, updateCourse } from "../../actions";

export const metadata = { title: "Edit course" };

export default async function CourseEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCourseForEditing(id);
  if (!data) notFound();
  const { course, modules, lessonCount, studentCount } = data;
  const isPublished = course.status === "published";

  return (
    <div className="et-page">
      <Link href="/teach/courses" className="et-back">
        <ArrowLeft size={14} />
        Courses
      </Link>
      <div className="et-page-head">
        <div>
          <h1>
            {course.title} <Status value={course.status} />
          </h1>
          <p>
            {lessonCount} lessons · {studentCount} students
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/learn/course/${course.id}`} className="et-btn et-btn-ghost">
            <Eye size={15} />
            Preview
          </Link>
          <form action={setCourseStatus}>
            <input type="hidden" name="id" value={course.id} />
            <input type="hidden" name="status" value={isPublished ? "draft" : "published"} />
            <button
              type="submit"
              className={`et-btn ${isPublished ? "et-btn-ghost" : "et-btn-primary"}`}
              disabled={!isPublished && lessonCount === 0}
              data-tip={!isPublished && lessonCount === 0 ? "Add at least one lesson first" : undefined}
            >
              {isPublished ? "Unpublish" : "Publish"}
            </button>
          </form>
        </div>
      </div>

      <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 400px" }}>
        <section className="et-card">
          <div className="et-card-head">
            <h2>Curriculum</h2>
          </div>
          <div className="et-curriculum">
            {modules.map((m, mi) => (
              <div key={m.id} className="et-module">
                <div className="et-module-head">
                  <span>
                    {mi + 1}. {m.title}
                  </span>
                  <div className="et-row-actions">
                    <form action={deleteModule}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="is-danger" aria-label="Delete module" data-tip="Delete module and its lessons">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                </div>
                {m.lessons.map((l) => (
                  <Link key={l.id} href={`/teach/courses/${course.id}/lessons/${l.id}`} className="et-lesson">
                    {l.video_url ? <PlayCircle size={15} /> : <FileText size={15} />}
                    <span className="et-lesson-title">{l.title}</span>
                    {l.is_preview && <span className="et-tag">Preview</span>}
                    {l.duration_seconds ? <small>{formatDuration(l.duration_seconds)}</small> : null}
                    <Pencil size={13} />
                  </Link>
                ))}
                <form action={addLesson} className="et-inline-form">
                  <input type="hidden" name="moduleId" value={m.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <input name="title" className="et-input" placeholder="New lesson title" required aria-label="New lesson title" />
                  <button type="submit" className="et-btn et-btn-ghost et-btn-sm">
                    Add lesson
                  </button>
                </form>
              </div>
            ))}
          </div>
          <form action={addModule} className="et-inline-form" style={{ borderTop: "1px solid var(--a-border)", padding: "16px 20px" }}>
            <input type="hidden" name="courseId" value={course.id} />
            <input name="title" className="et-input" placeholder="New module title" required aria-label="New module title" />
            <button type="submit" className="et-btn et-btn-primary et-btn-sm">
              Add module
            </button>
          </form>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Details</h2>
            </div>
            <div className="et-card-pad">
              <ActionForm action={updateCourse}>
                <input type="hidden" name="id" value={course.id} />
                <div className="et-field">
                  <label htmlFor="title">Title</label>
                  <input id="title" name="title" defaultValue={course.title} required />
                </div>
                <div className="et-field">
                  <label htmlFor="slug">URL slug</label>
                  <input id="slug" name="slug" defaultValue={course.slug} required />
                </div>
                <div className="et-field">
                  <label htmlFor="summary">Summary</label>
                  <textarea id="summary" name="summary" rows={2} defaultValue={course.summary ?? ""} />
                </div>
                <div className="et-field">
                  <label htmlFor="description">Description</label>
                  <textarea id="description" name="description" rows={5} defaultValue={course.description ?? ""} />
                </div>
                <div className="et-field">
                  <label htmlFor="cover_url">Cover image URL</label>
                  <input id="cover_url" name="cover_url" type="url" defaultValue={course.cover_url ?? ""} placeholder="https://" />
                </div>
                <div className="et-form-grid">
                  <div className="et-field">
                    <label htmlFor="level">Level</label>
                    <select id="level" name="level" defaultValue={course.level}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div className="et-field">
                    <label htmlFor="price">Price (₦)</label>
                    <input id="price" name="price" inputMode="decimal" defaultValue={course.price_minor ? course.price_minor / 100 : ""} placeholder="0" />
                  </div>
                </div>
                <div className="et-form-foot">
                  <SubmitButton>Save details</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </section>

          {course.status === "draft" && (
            <section className="et-card et-card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 13, color: "var(--a-muted)" }}>Drafts can be deleted.</span>
              <form action={deleteCourse}>
                <input type="hidden" name="id" value={course.id} />
                <button type="submit" className="et-btn et-btn-sm et-btn-danger-text">
                  <Trash2 size={14} />
                  Delete course
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
