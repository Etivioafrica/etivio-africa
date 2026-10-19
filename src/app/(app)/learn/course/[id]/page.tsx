import Link from "next/link";
import { videoEmbed } from "@/lib/video";
import { notFound } from "next/navigation";
import { ArrowLeft, Bookmark, Check, ChevronRight, Download, FileText, ListChecks, Lock, Paperclip, PlayCircle } from "lucide-react";
import { Progress } from "@/components/dash/ui";
import { getCoursePlayer } from "@/lib/data/learn";
import { formatBytes, formatDuration } from "@/lib/format";
import { toHtml } from "@/lib/blog";
import { sanitizeRichText } from "@/lib/sanitize";
import { createClient } from "@/lib/supabase/server";
import { setLessonDone } from "../../actions";
import { LessonNotes } from "./LessonNotes";
import { ReviewCard } from "./ReviewCard";

export const metadata = { title: "Course" };


export default async function CoursePlayer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lesson?: string }> }) {
  const [{ id }, { lesson: lessonParam }] = await Promise.all([params, searchParams]);
  const data = await getCoursePlayer(id);
  if (!data) notFound();

  const { course, modules, lessons, doneCount, progress, quizzes, passedCount, review } = data;
  // RLS limits this to documents the viewer may open (enrolled, owner, or public).
  const supabase = await createClient();
  const [{ data: docs }, { data: notes }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, description, file_url, file_name, file_size")
      .eq("course_id", id)
      .is("lesson_id", null)
      .neq("visibility", "private")
      .order("created_at"),
    supabase
      .from("lesson_notes")
      .select("lesson_id, body, bookmarked")
      .in(
        "lesson_id",
        lessons.map((l) => l.id),
      ),
  ]);
  const noteBy = new Map((notes ?? []).map((n) => [n.lesson_id, n]));
  const { data: lessonFiles } = await supabase
    .from("documents")
    .select("id, title, file_url, file_name, file_size, lesson_id")
    .eq("course_id", id)
    .not("lesson_id", "is", null)
    .order("created_at");
  const filesBy = (lessonId: string) => (lessonFiles ?? []).filter((f) => f.lesson_id === lessonId);
  const lockedIds = new Set(modules.filter((m) => m.locked).flatMap((m) => m.lessons.map((l) => l.id)));
  const open = lessons.filter((l) => !lockedIds.has(l.id));
  const current = lessons.find((l) => l.id === lessonParam) ?? open.find((l) => !l.done) ?? open[0] ?? lessons[0];
  const idx = current ? lessons.indexOf(current) : -1;
  const base = `/learn/course/${id}`;
  const currentModule = modules.find((m) => m.lessons.some((l) => l.id === current?.id));
  const isLocked = !!current && lockedIds.has(current.id);
  // After a module's last lesson, its quiz comes next (if not passed yet).
  const quizNext = currentModule?.quiz && !currentModule.quiz.passed && currentModule.lessons.at(-1)?.id === current?.id ? currentModule.quiz : null;
  const nextLesson = idx >= 0 ? lessons[idx + 1] : undefined;
  const next = quizNext
    ? { id: quizNext.id, href: `${base}/quiz/${quizNext.id}`, label: "Take the module quiz" }
    : nextLesson
      ? { id: nextLesson.id, href: `${base}?lesson=${nextLesson.id}`, label: "Next lesson" }
      : null;
  const video = current?.videoUrl ? videoEmbed(current.videoUrl) : null;

  return (
    <div className="et-page">
      <Link href="/learn/courses" className="et-back">
        <ArrowLeft size={14} />
        My courses
      </Link>
      <div className="et-page-head">
        <div>
          <h1>{course.title}</h1>
          <p>{course.instructor}</p>
        </div>
        <div style={{ width: 240 }}>
          <Progress value={progress} label={`${doneCount + passedCount}/${lessons.length + quizzes.length}`} />
        </div>
      </div>

      <div className="et-grid-main">
        <section className="et-card">
          {current && isLocked ? (
            <div className="et-quiz-locked">
              <Lock size={22} />
              <h2>{currentModule?.title} is locked</h2>
              <p>Pass the quiz at the end of the previous module to unlock it.</p>
              {(() => {
                const gate = modules.slice(0, modules.indexOf(currentModule!)).find((m) => m.quiz && !m.quiz.passed)?.quiz;
                return gate ? (
                  <Link href={`${base}/quiz/${gate.id}`} className="et-btn et-btn-primary">
                    <ListChecks size={15} /> Take {gate.title}
                  </Link>
                ) : null;
              })()}
            </div>
          ) : current ? (
            <>
              {video && (
                <div className="et-video">
                  {video.kind === "iframe" ? (
                    <iframe src={video.src} title={current.title} allow="fullscreen; picture-in-picture" allowFullScreen />
                  ) : (
                    <video src={video.src} controls preload="metadata" />
                  )}
                </div>
              )}
              <div className="et-lesson-body">
                <h2>{current.title}</h2>
                {current.kind === "reading" && current.durationSeconds ? (
                  <p className="et-lesson-meta">
                    <FileText size={13} /> Reading · {formatDuration(current.durationSeconds)}
                  </p>
                ) : null}
                {current.content ? (
                  <div className="et-rich et-lesson-rich" dangerouslySetInnerHTML={{ __html: sanitizeRichText(toHtml(current.content)) }} />
                ) : (
                  !video && <p style={{ color: "var(--a-faint)" }}>This lesson has no content yet.</p>
                )}
                {filesBy(current.id).length > 0 && (
                  <div className="et-lesson-res">
                    <h3>Resources</h3>
                    <ul>
                      {filesBy(current.id).map((f) => (
                        <li key={f.id}>
                          <span className="et-res-icon">
                            <FileText size={16} />
                          </span>
                          <span>
                            <b>{f.title}</b>
                            <small>{f.file_size ? formatBytes(f.file_size) : f.file_name}</small>
                          </span>
                          <a href={f.file_url} target="_blank" rel="noreferrer" className="et-btn et-btn-ghost et-btn-sm">
                            <Download size={14} /> Download
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <LessonNotes
                key={current.id}
                lessonId={current.id}
                initialBody={noteBy.get(current.id)?.body ?? ""}
                initialBookmarked={noteBy.get(current.id)?.bookmarked ?? false}
              />
              <div className="et-lesson-foot">
                <form action={setLessonDone}>
                  <input type="hidden" name="lessonId" value={current.id} />
                  <input type="hidden" name="done" value={current.done ? "0" : "1"} />
                  {next && <input type="hidden" name="next" value={next.href} />}
                  <button type="submit" className={`et-btn ${current.done ? "et-btn-success" : "et-btn-primary"}`}>
                    <Check size={15} />
                    {current.done ? "Completed" : quizNext ? "Mark complete and take the quiz" : next ? "Mark complete and continue" : "Mark complete"}
                  </button>
                </form>
                {next && (
                  <Link href={next.href} className="et-btn et-btn-ghost">
                    {next.label}
                    <ChevronRight size={15} />
                  </Link>
                )}
              </div>
            </>
          ) : (
            <p className="et-empty et-empty-lg">This course has no lessons yet.</p>
          )}
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <aside className="et-card">
            <div className="et-card-head">
              <h2>Course content</h2>
            </div>
            <div className="et-curriculum">
              {modules.map((m) => (
                <div key={m.id} className="et-module">
                  <div className="et-module-head">
                    <span>
                      {m.locked && <Lock size={12} />} {m.title}
                    </span>
                    <small>{m.lessons.length} lessons</small>
                  </div>
                  {m.lessons.map((l) =>
                    m.locked ? (
                      <span key={l.id} className="et-lesson is-locked" title="Pass the previous module's quiz to unlock">
                        <span className="et-lesson-dot" />
                        <span className="et-lesson-title">{l.title}</span>
                        <Lock size={12} />
                      </span>
                    ) : (
                      <Link key={l.id} href={`${base}?lesson=${l.id}`} className={`et-lesson${l.id === current?.id ? " is-active" : ""}`}>
                        <span className={`et-lesson-dot${l.done ? " is-done" : ""}`}>{l.done ? <Check size={11} strokeWidth={3} /> : null}</span>
                        <span className="et-lesson-title">{l.title}</span>
                        {noteBy.get(l.id)?.bookmarked && <Bookmark size={13} fill="currentColor" aria-label="Bookmarked" />}
                        {l.kind === "reading" ? <FileText size={14} /> : l.videoUrl ? <PlayCircle size={14} /> : null}
                      {filesBy(l.id).length > 0 && <Paperclip size={12} aria-label="Has resources" />}
                        {l.durationSeconds ? <small>{formatDuration(l.durationSeconds)}</small> : null}
                      </Link>
                    ),
                  )}
                  {m.quiz &&
                    (m.locked ? (
                      <span className="et-lesson et-lesson-quiz is-locked">
                        <ListChecks size={14} />
                        <span className="et-lesson-title">{m.quiz.title}</span>
                        <Lock size={12} />
                      </span>
                    ) : (
                      <Link href={`${base}/quiz/${m.quiz.id}`} className={`et-lesson et-lesson-quiz${m.quiz.passed ? " is-passed" : ""}`}>
                        <span className={`et-lesson-dot${m.quiz.passed ? " is-done" : ""}`}>{m.quiz.passed ? <Check size={11} strokeWidth={3} /> : null}</span>
                        <span className="et-lesson-title">{m.quiz.title}</span>
                        <small>{m.quiz.passed ? "Passed" : m.quiz.best !== null ? `Best ${m.quiz.best}%` : "Quiz"}</small>
                      </Link>
                    ))}
                </div>
              ))}
            </div>
          </aside>
          {!data.isOwner && <ReviewCard courseId={id} canReview={review.canReview} mine={review.mine} progress={progress} />}
          {!!docs?.length && (
            <section className="et-card">
              <div className="et-card-head">
                <h2>
                  <FileText size={15} />
                  Course materials
                </h2>
              </div>
              <ul className="et-feed">
                {docs.map((d) => (
                  <li key={d.id}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <b>{d.title}</b>
                      <br />
                      <small className="et-muted">{d.file_size ? formatBytes(d.file_size) : d.file_name}</small>
                    </span>
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="et-btn et-btn-ghost et-btn-sm" aria-label={`Download ${d.title}`}>
                      <Download size={14} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
