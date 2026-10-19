import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, Award, BookOpen, CheckCircle2, Eye, FileText, ListChecks, Pencil, PlayCircle, Star, Trash2, Users, Wallet } from "lucide-react";
import { Status, StatStrip } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { Uploader } from "@/components/dash/Uploader";
import { requireAdmin } from "@/lib/admin";
import { compactMoney, formatDate, formatDuration } from "@/lib/format";
import { courseMetrics, getCourseCategories, getStudentProgress, loadReviews } from "@/lib/data/courses-admin";
import { adminAddLesson, adminAddModule, adminDeleteCourse, adminDeleteModule, adminSetCourseStatus, adminUpdateCourse, adminUpdatePricing } from "../actions";
import { getInstructorOptions } from "../instructors";
import { StudentsTable } from "../students/StudentsTable";
import { ReviewsClient } from "../reviews/ReviewsClient";
import { AddQuizButton } from "./QuizButton";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "curriculum", label: "Curriculum" },
  { id: "students", label: "Students" },
  { id: "reviews", label: "Reviews" },
  { id: "pricing", label: "Pricing" },
  { id: "settings", label: "Settings" },
] as const;
type Tab = (typeof TABS)[number]["id"];
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

export const metadata = { title: "Edit course" };

export default function AdminCourseEditor(props: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 560 }} />}>
      <CourseEditor {...props} />
    </Suspense>
  );
}

async function CourseEditor({ params, searchParams }: Props) {
  const [{ id }, { tab: wanted }] = await Promise.all([params, searchParams]);
  const tab: Tab = TABS.find((t) => t.id === wanted)?.id ?? "overview";
  const { db } = await requireAdmin("courses");
  const { data: course } = await db.from("courses").select("*, instructor:profiles!courses_instructor_id_fkey(full_name)").eq("id", id).maybeSingle();
  if (!course) notFound();

  const [{ data: modules }, { data: lessons }, { data: students }, { data: docs }, instructors, { data: quizzes }, categories, metricsAll, { data: questions }] = await Promise.all([
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
    db.from("course_quizzes").select("id, title, module_id, pass_mark").eq("course_id", id),
    getCourseCategories(),
    courseMetrics(),
    db.from("quiz_questions").select("quiz_id"),
  ]);
  const metrics = metricsAll[id] ?? { students: 0, completed: 0, revenue: 0, rating: null, reviews: 0, pendingReviews: 0 };
  const quizBy = new Map((quizzes ?? []).map((q) => [q.module_id, { ...q, questions: (questions ?? []).filter((x) => x.quiz_id === q.id).length }]));
  const tree = (modules ?? []).map((m) => ({ ...m, lessons: (lessons ?? []).filter((l) => l.module_id === m.id) }));
  const lessonCount = lessons?.length ?? 0;

  const lessonsWithContent = (lessons ?? []).filter((l) => l.video_url || l.content).length;
  const checklist = [
    { ok: !!course.cover_url, label: "Cover image", tab: "settings" },
    { ok: !!course.summary, label: "Short summary", tab: "settings" },
    { ok: !!course.category_id, label: "Category", tab: "settings" },
    { ok: lessonCount > 0, label: "At least one lesson", tab: "curriculum" },
    { ok: lessonCount > 0 && lessonsWithContent === lessonCount, label: `Every lesson has a video or text (${lessonsWithContent}/${lessonCount})`, tab: "curriculum" },
    { ok: (course.skills ?? []).length > 0, label: "Skills learners will earn", tab: "settings" },
  ];
  const completion = metrics.students ? Math.round((metrics.completed / metrics.students) * 100) : null;
  const href = (t: Tab) => (t === "overview" ? `/admin/courses/${course.id}` : `/admin/courses/${course.id}?tab=${t}`);
  const counts: Partial<Record<Tab, number>> = { curriculum: lessonCount, students: students?.length ?? 0, reviews: metrics.pendingReviews };

  return (
    <div className="et-page">
      <p className="et-set-crumb">
        <BookOpen size={12} />
        <Link href="/admin/courses">Courses</Link> <span>/</span> {course.title} <span>/</span> {TABS.find((t) => t.id === tab)?.label}
      </p>
      <div className="et-page-head">
        <div>
          <h1>
            {course.title} <Status value={course.status} />
          </h1>
          <p>
            {course.instructor?.full_name || "No instructor"} · {lessonCount} lessons · {quizzes?.length ?? 0} quizzes · created {formatDate(course.created_at)}
          </p>
        </div>
        <div className="et-inline">
          <Link href={`/learn/course/${course.id}`} className="et-btn et-btn-ghost" target="_blank">
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

      <nav className="et-seg" aria-label="Course sections" style={{ alignSelf: "flex-start" }}>
        {TABS.map((t) => (
          <Link key={t.id} href={href(t.id)} scroll={false} className={tab === t.id ? "is-on" : ""} aria-current={tab === t.id ? "page" : undefined}>
            {t.label}
            {!!counts[t.id] && <span className="et-seg-count">{counts[t.id]}</span>}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <StatStrip
            items={[
              { label: "Students", value: metrics.students, icon: Users, href: href("students") },
              { label: "Completion", value: completion === null ? "None yet" : `${completion}%`, icon: Award, hint: `${metrics.completed} certificates` },
              { label: "Rating", value: metrics.rating ? `${metrics.rating.toFixed(1)} ★` : "No reviews", icon: Star, href: href("reviews"), hint: metrics.pendingReviews ? `${metrics.pendingReviews} waiting` : undefined },
              { label: "Revenue", value: course.price_minor ? compactMoney(metrics.revenue) : "Free course", icon: Wallet, href: href("pricing") },
            ]}
          />
          <div className="et-grid-2" style={{ alignItems: "start" }}>
            <section className="et-card">
              <div className="et-card-head">
                <h2>Ready to learn?</h2>
                <span className="et-muted" style={{ fontSize: 12.5 }}>
                  {checklist.filter((c) => c.ok).length}/{checklist.length} done
                </span>
              </div>
              <ul className="et-checklist">
                {checklist.map((c) => (
                  <li key={c.label} className={c.ok ? "is-ok" : ""}>
                    {c.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{c.label}</span>
                    {!c.ok && <Link href={href(c.tab as Tab)}>Fix</Link>}
                  </li>
                ))}
              </ul>
            </section>
            <section className="et-card">
              <div className="et-card-head">
                <h2>Newest students</h2>
                <Link href={href("students")}>All students</Link>
              </div>
              {students?.length ? (
                <ul className="et-people">
                  {students.slice(0, 6).map((st) => (
                    <li key={st.user_id}>
                      <Link href={`/admin/users/${st.user_id}`}>
                        <span className="et-avatar">{(st.student?.full_name || "?").charAt(0).toUpperCase()}</span>
                        <span className="et-people-main">
                          <b>{st.student?.full_name || "Unnamed"}</b>
                          <small>Enrolled {formatDate(st.enrolled_at)}</small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="et-empty">No students yet.</p>
              )}
              <div className="et-card-foot-link">
                <Link href={`/admin/courses/metrics?course=${course.id}`}>See where learners stop →</Link>
              </div>
            </section>
          </div>
        </>
      )}

      {tab === "curriculum" && (
        <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
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
                  {quizBy.get(m.id) ? (
                    <Link href={`/admin/courses/${course.id}/quizzes/${quizBy.get(m.id)!.id}`} className="et-lesson et-lesson-quiz">
                      <ListChecks size={15} />
                      <span className="et-lesson-title">{quizBy.get(m.id)!.title}</span>
                      <span className={`et-tag${quizBy.get(m.id)!.questions ? "" : " is-warn"}`}>
                        {quizBy.get(m.id)!.questions ? `${quizBy.get(m.id)!.questions} questions · pass ${quizBy.get(m.id)!.pass_mark}%` : "No questions yet"}
                      </span>
                      <Pencil size={13} />
                    </Link>
                  ) : (
                    m.lessons.length > 0 && <AddQuizButton moduleId={m.id} courseId={course.id} />
                  )}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="et-blog-note">
              <b>Quizzes</b>
              <p>Add a short quiz at the end of a module. Learners must reach the pass mark to unlock the next module, and every quiz must be passed to finish the course and get the certificate.</p>
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
        </div>
      )}

      {tab === "students" && (
        <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
          <CourseStudents courseId={course.id} title={course.title} />
        </Suspense>
      )}

      {tab === "reviews" && (
        <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
          <CourseReviews courseId={course.id} />
        </Suspense>
      )}

      {tab === "pricing" && (
        <section className="et-card et-card-pad" style={{ maxWidth: 640 }}>
          <ActionForm action={adminUpdatePricing} toast>
            <input type="hidden" name="id" value={course.id} />
            <div className="et-wiz-choice et-wiz-choice-radio">
              <label>
                <input type="radio" name="mode" value="free" defaultChecked={!course.price_minor} />
                <b>Free</b>
                <small>Anyone can enrol straight away.</small>
              </label>
              <label>
                <input type="radio" name="mode" value="paid" defaultChecked={!!course.price_minor} />
                <b>Paid</b>
                <small>Learners pay once through Paystack and keep access.</small>
              </label>
            </div>
            <div className="et-field" style={{ maxWidth: 280 }}>
              <label htmlFor="price">Price (₦)</label>
              <input id="price" name="price" inputMode="decimal" defaultValue={course.price_minor ? course.price_minor / 100 : ""} placeholder="e.g. 15000" />
              <small>Only used when the course is paid. Minimum ₦500.</small>
            </div>
            <p className="et-muted" style={{ fontSize: 12.5 }}>
              Changing the price never affects people who already enrolled. Revenue so far: <b>{compactMoney(metrics.revenue)}</b>.
            </p>
            <div className="et-form-foot">
              <SubmitButton>Save pricing</SubmitButton>
            </div>
          </ActionForm>
        </section>
      )}

      {tab === "settings" && (
        <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Course details</h2>
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
                  <label htmlFor="category_id">Category</label>
                  <select id="category_id" name="category_id" defaultValue={course.category_id ?? ""}>
                    <option value="">Choose a category</option>
                    {categories
                      .filter((c) => !c.parent_id)
                      .flatMap((p) => [
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>,
                        ...categories
                          .filter((c) => c.parent_id === p.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {p.name} › {c.name}
                            </option>
                          )),
                      ])}
                  </select>
                  <small>Used to recommend this course to learners interested in the topic.</small>
                </div>
                <div className="et-field">
                  <label htmlFor="skills">Skills taught</label>
                  <input id="skills" name="skills" defaultValue={(course.skills ?? []).join(", ")} placeholder="Figma, UI design, Prototyping" />
                  <small>Learners earn these on their profile when they finish the course. Separate with commas, up to 12.</small>
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
                </div>
                <div className="et-form-foot">
                  <SubmitButton>Save details</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </section>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
      )}
    </div>
  );
}

async function CourseStudents({ courseId, title }: { courseId: string; title: string }) {
  const rows = await getStudentProgress(courseId);
  return <StudentsTable rows={rows} courses={[{ id: courseId, title }]} initialCourse={courseId} fixedCourse />;
}

async function CourseReviews({ courseId }: { courseId: string }) {
  return <ReviewsClient reviews={await loadReviews(courseId)} hideCourse />;
}
