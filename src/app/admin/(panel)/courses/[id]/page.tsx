import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, FileText, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { Status } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { Uploader } from "@/components/dash/Uploader";
import { requireAdmin } from "@/lib/admin";
import { formatDate, formatDuration } from "@/lib/format";
import { adminAddLesson, adminAddModule, adminDeleteCourse, adminDeleteModule, adminSetCourseStatus, adminUpdateCourse } from "../actions";
import { getInstructorOptions } from "../instructors";

export const metadata = { title: "Edit course" };

export default async function AdminCourseEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const { data: course } = await db.from("courses").select("*").eq("id", id).maybeSingle();
  if (!course) notFound();

  const [{ data: modules }, { data: lessons }, { data: students }, { data: docs }, instructors] = await Promise.all([
    db.from("course_modules").select("id, title, position").eq("course_id", id).order("position"),
    db.from("lessons").select("*").eq("course_id", id).order("position"),
    db
      .from("enrollments")
      .select("user_id, enrolled_at, completed_at, student:profiles!enrollments_user_id_fkey(full_name)")
      .eq("course_id", id)
      .order("enrolled_at", { ascending: false })
      .limit(50),
    db.from("documents").select("id, title, visibility").eq("course_id", id).order("created_at", { ascending: false }),
    getInstructorOptions(db),
  ]);
  const tree = (modules ?? []).map((m) => ({ ...m, lessons: (lessons ?? []).filter((l) => l.module_id === m.id) }));
  const lessonCount = lessons?.length ?? 0;

  return (
    <div className="et-page">
      <Link href="/admin/courses" className="et-back">
        <ArrowLeft size={14} />
        Courses
      </Link>
      <div className="et-page-head">
        <div>
          <h1>
            {course.title} <Status value={course.status} />
          </h1>
          <p>
            {lessonCount} lessons · {students?.length ?? 0} students · created {formatDate(course.created_at)}
          </p>
        </div>
        <div className="et-inline">
          <Link href={`/learn/course/${course.id}`} className="et-btn et-btn-ghost">
            <Eye size={15} />
            Preview
          </Link>
          {(["draft", "published", "archived"] as const)
            .filter((s) => s !== course.status)
            .map((s) => (
              <form key={s} action={adminSetCourseStatus}>
                <input type="hidden" name="id" value={course.id} />
                <input type="hidden" name="status" value={s} />
                <button
                  type="submit"
                  className={`et-btn ${s === "published" ? "et-btn-primary" : "et-btn-ghost"}`}
                  disabled={s === "published" && lessonCount === 0}
                  data-tip={s === "published" && lessonCount === 0 ? "Add at least one lesson first" : undefined}
                >
                  {s === "published" ? "Publish" : s === "draft" ? "Move to draft" : "Archive"}
                </button>
              </form>
            ))}
        </div>
      </div>

      <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 400px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Curriculum</h2>
            </div>
            <div className="et-curriculum">
              {tree.map((m, mi) => (
                <div key={m.id} className="et-module">
                  <div className="et-module-head">
                    <span>
                      {mi + 1}. {m.title}
                    </span>
                    <div className="et-row-actions">
                      <form action={adminDeleteModule}>
                        <input type="hidden" name="id" value={m.id} />
                        <button type="submit" className="is-danger" aria-label="Delete module" data-tip="Delete module and its lessons">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </div>
                  {m.lessons.map((l) => (
                    <Link key={l.id} href={`/admin/courses/${course.id}/lessons/${l.id}`} className="et-lesson">
                      {l.video_url ? <PlayCircle size={15} /> : <FileText size={15} />}
                      <span className="et-lesson-title">{l.title}</span>
                      {l.is_preview && <span className="et-tag">Preview</span>}
                      {l.duration_seconds ? <small>{formatDuration(l.duration_seconds)}</small> : null}
                      <Pencil size={13} />
                    </Link>
                  ))}
                  <form action={adminAddLesson} className="et-inline-form">
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
            <form action={adminAddModule} className="et-inline-form" style={{ borderTop: "1px solid var(--a-border)", padding: "16px 20px" }}>
              <input type="hidden" name="courseId" value={course.id} />
              <input name="title" className="et-input" placeholder="New module title" required aria-label="New module title" />
              <button type="submit" className="et-btn et-btn-primary et-btn-sm">
                Add module
              </button>
            </form>
          </section>

          <section className="et-card">
            <div className="et-card-head">
              <h2>Students</h2>
              <span className="et-muted">{students?.length ?? 0}</span>
            </div>
            {students?.length ? (
              <table className="et-table">
                <tbody>
                  {students.map((s) => (
                    <tr key={s.user_id}>
                      <td>
                        <Link href={`/admin/users/${s.user_id}`}>
                          <b>{s.student?.full_name || "Unnamed"}</b>
                        </Link>
                      </td>
                      <td>{s.completed_at ? <Status value="completed" /> : <Status value="in progress" />}</td>
                      <td>{formatDate(s.enrolled_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="et-empty">No students yet.</p>
            )}
          </section>

          <section className="et-card">
            <div className="et-card-head">
              <h2>Course documents</h2>
              <Link href={`/admin/documents?course=${course.id}`}>Manage</Link>
            </div>
            {docs?.length ? (
              <ul className="et-feed">
                {docs.map((d) => (
                  <li key={d.id}>
                    <FileText size={14} />
                    <b>{d.title}</b>
                    <Status value={d.visibility} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="et-empty">No documents attached.</p>
            )}
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Details</h2>
            </div>
            <div className="et-card-pad">
              <ActionForm action={adminUpdateCourse}>
                <input type="hidden" name="id" value={course.id} />
                <div className="et-field">
                  <label>Cover image</label>
                  <Uploader name="cover_url" kind="cover" defaultUrl={course.cover_url} label="Upload a cover image" />
                </div>
                <div className="et-field">
                  <label htmlFor="title">Title</label>
                  <input id="title" name="title" defaultValue={course.title} required />
                </div>
                <div className="et-field">
                  <label htmlFor="instructor_id">Instructor</label>
                  <select id="instructor_id" name="instructor_id" defaultValue={course.instructor_id}>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                  </select>
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

          <section className="et-card et-card-pad" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--a-muted)" }}>{students?.length ? "Courses with students can only be archived." : "Delete this course and its files."}</span>
            {!students?.length && (
              <form action={adminDeleteCourse}>
                <input type="hidden" name="id" value={course.id} />
                <button type="submit" className="et-btn et-btn-sm et-btn-danger-text">
                  <Trash2 size={14} />
                  Delete
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
