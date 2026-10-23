import Link from "next/link";
import { videoSource } from "@/lib/video";
import { LessonVideo } from "@/components/learn/LessonVideo";
import { notFound } from "next/navigation";
import { BarChart3, BookOpen, Check, Pin, ChevronRight, Clock, Download, FileText, ListChecks, Lock, UserRound } from "lucide-react";
import { PlayerFrame } from "@/components/learn/PlayerFrame";
import { buildOutline } from "@/lib/player";
import { getCoursePlayer } from "@/lib/data/learn";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/format";
import { toHtml } from "@/lib/blog";
import { sanitizeRichText } from "@/lib/sanitize";
import { createClient } from "@/lib/supabase/server";
import { setLessonDone } from "@/app/(app)/learn/actions";
import { reportLessonDuration } from "@/app/(app)/learn/course-actions";
import { LessonNotes } from "./LessonNotes";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { Status } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { askFromLesson } from "@/app/(app)/support/actions";
import { formatAnnouncementDate, liveDate, stripHtml } from "@/lib/announcements";
import { ReviewCard } from "@/components/learn/ReviewCard";
import { AskAi } from "@/components/learn/AskAi";
import { MessageTutor } from "@/components/chat/MessageTutor";
import { conversationFor } from "@/lib/data/messages";
import { LESSON_CHAT_DAILY_LIMIT } from "@/lib/ai";

export const metadata = { title: "Course" };


// Read per request (the player is dynamic), outside render so it stays pure.
const dayAgo = () => new Date(Date.now() - 86_400_000).toISOString();

export default async function CoursePlayer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lesson?: string }> }) {
  const [{ id }, { lesson: lessonParam }] = await Promise.all([params, searchParams]);
  const data = await getCoursePlayer(id);
  if (!data) notFound();

  const { course, modules, lessons, doneCount, progress, quizzes, passedCount, review } = data;
  // RLS limits this to documents the viewer may open (enrolled, owner, or public).
  const supabase = await createClient();
  const user = await getCurrentUser();
  const [{ data: docs }, { data: notes }, { data: threads }, { data: news }] = await Promise.all([
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
    supabase.from("support_threads").select("id, subject, status, user_unread, last_message_at").eq("user_id", user.id).order("last_message_at", { ascending: false }).limit(5),
    // RLS returns only live announcements.
    supabase
      .from("announcements")
      .select("id, title, body, status, pinned, created_at, scheduled_at, course_id")
      .or(`course_id.is.null,course_id.eq.${id}`)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
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
  // Study assistant: this lesson's earlier questions and how many are left today (RLS returns only the viewer's own).
  const [{ data: aiHistory }, { count: aiUsed }] = current && !isLocked
    ? await Promise.all([
        supabase.from("ai_messages").select("role, content").eq("lesson_id", current.id).eq("feature", "lesson_chat").order("created_at", { ascending: false }).limit(20),
        supabase.from("ai_messages").select("id", { count: "exact", head: true }).eq("feature", "lesson_chat").eq("role", "user").gte("created_at", dayAgo()),
      ])
    : [{ data: [] }, { count: 0 }];
  const nextLesson = idx >= 0 ? lessons[idx + 1] : undefined;
  const next = quizNext
    ? { id: quizNext.id, href: `${base}/quiz/${quizNext.id}`, label: "Take the module quiz" }
    : nextLesson
      ? { id: nextLesson.id, href: `${base}?lesson=${nextLesson.id}`, label: "Next lesson" }
      : null;
  const video = current?.videoUrl ? videoSource(current.videoUrl) : null;
  const prevLesson = idx > 0 ? lessons[idx - 1] : undefined;

  const frame = {
    course: { id, title: course.title, slug: course.slug },
    outline: buildOutline(base, modules),
    activeId: current?.id ?? null,
    progress,
    steps: { done: doneCount + passedCount, total: lessons.length + quizzes.length },
  };

  if (!current || isLocked)
    return (
      <PlayerFrame {...frame}>
        {current ? (
          <section className="et-card et-quiz-locked">
            <Lock size={22} />
            <h2>{currentModule?.title} is locked</h2>
            <p>Pass the quiz at the end of the previous section to unlock it.</p>
            {(() => {
              const gate = modules.slice(0, modules.indexOf(currentModule!)).find((m) => m.quiz && !m.quiz.passed)?.quiz;
              return gate ? (
                <Link href={`${base}/quiz/${gate.id}`} className="et-btn et-btn-primary">
                  <ListChecks size={15} /> Take {gate.title}
                </Link>
              ) : null;
            })()}
          </section>
        ) : (
          <p className="et-empty et-empty-lg">This course has no lessons yet.</p>
        )}
      </PlayerFrame>
    );

  const files = filesBy(current.id);
  const totalSeconds = lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0);
  const prev = prevLesson && !lockedIds.has(prevLesson.id) ? { href: `${base}?lesson=${prevLesson.id}`, label: "Previous lesson" } : null;

  const resources = (
    <div className="et-pl-stack">
      {files.length > 0 && (
        <section className="et-card et-lesson-res et-pl-res">
          <h3>This lesson</h3>
          <ul>
            {files.map((f) => (
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
        </section>
      )}
      {!!docs?.length && (
        <section className="et-card et-lesson-res et-pl-res">
          <h3>Course materials</h3>
          <ul>
            {docs.map((d) => (
              <li key={d.id}>
                <span className="et-res-icon">
                  <FileText size={16} />
                </span>
                <span>
                  <b>{d.title}</b>
                  <small>{d.file_size ? formatBytes(d.file_size) : d.file_name}</small>
                </span>
                <a href={d.file_url} target="_blank" rel="noreferrer" className="et-btn et-btn-ghost et-btn-sm">
                  <Download size={14} /> Download
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  const overview = (
    <div className="et-pl-overview">
      {/* With a video the title already sits under it. */}
      {!video && <h1>{current.title}</h1>}
      {current.kind === "reading" && current.durationSeconds ? (
        <p className="et-lesson-meta">
          <FileText size={13} /> Reading · {formatDuration(current.durationSeconds)}
        </p>
      ) : null}
      {current.content ? (
        <div className="et-rich et-lesson-rich" dangerouslySetInnerHTML={{ __html: sanitizeRichText(toHtml(current.content)) }} />
      ) : (
        !video && <p className="et-muted">This lesson has no content yet.</p>
      )}
      {(files.length > 0 || !!docs?.length) && resources}
      <div className="et-pl-about">
        <h2>{course.title}</h2>
        {course.summary && <p>{course.summary}</p>}
        <ul className="et-pl-facts">
          <li>
            <UserRound size={16} />
            <span>
              <b>{course.instructor}</b>
              <small>Tutor</small>
            </span>
          </li>
          <li>
            <BookOpen size={16} />
            <span>
              <b>{lessons.length}</b>
              <small>{lessons.length === 1 ? "Lesson" : "Lessons"}</small>
            </span>
          </li>
          {totalSeconds > 0 && (
            <li>
              <Clock size={16} />
              <span>
                <b>{formatDuration(totalSeconds)}</b>
                <small>Total</small>
              </span>
            </li>
          )}
          <li>
            <BarChart3 size={16} />
            <span>
              <b className="et-cap">{course.level}</b>
              <small>Level</small>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );

  const chatId = data.isOwner ? null : await conversationFor(id, user.id);
  const support = (
    <div className="et-pl-stack">
      {!data.isOwner && (
        <section className="et-card">
          <div className="et-card-head">
            <h2>Ask your tutor</h2>
          </div>
          <div className="et-card-pad">
            <p className="et-muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Questions about the course content go straight to {course.instructor}. They reply in Messages.
            </p>
            <MessageTutor courseId={id} tutorName={course.instructor} conversationId={chatId} />
          </div>
        </section>
      )}
      <section className="et-card">
        <div className="et-card-head">
          <h2>Ask the Etivio team</h2>
        </div>
        <ActionForm action={askFromLesson} className="et-form et-card-pad">
          <input type="hidden" name="subject" value={`${course.title}: ${current.title}`.slice(0, 140)} />
          <p className="et-muted" style={{ fontSize: 13 }}>
            About <b style={{ color: "var(--a-fg)" }}>{current.title}</b>. We reply here and by email.
          </p>
          <div className="et-field">
            <label htmlFor="ask-body">Your question</label>
            <textarea id="ask-body" name="body" rows={5} required minLength={5} maxLength={5000} placeholder="What do you need help with?" />
          </div>
          <div>
            <SubmitButton pendingLabel="Sending…">Send question</SubmitButton>
          </div>
        </ActionForm>
      </section>
      {!!threads?.length && (
        <section className="et-card">
          <div className="et-card-head">
            <h2>Your conversations</h2>
            <Link href="/support">All</Link>
          </div>
          <ul className="et-feed">
            {threads.map((t) => (
              <li key={t.id}>
                {t.user_unread && <span className="et-feed-dot" aria-label="New reply" />}
                <Link href={`/support/${t.id}`}>
                  <b>{t.subject}</b>
                </Link>
                <Status value={t.status === "pending" ? "replied" : t.status} />
                <time>{formatDateTime(t.last_message_at)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  const announcements = news?.length ? (
    <ul className="et-pl-news">
      {news.map((a) => (
        <li key={a.id}>
          <Link href={`/learn/announcements/${a.id}`} className="et-card et-card-pad">
            <small>
              {a.pinned && <Pin size={12} />} {formatAnnouncementDate(liveDate(a))}
              {a.course_id && <span className="et-pl-news-tag">This course</span>}
            </small>
            <b>{a.title}</b>
            <p>{stripHtml(a.body).slice(0, 220)}</p>
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <p className="et-empty">No announcements yet.</p>
  );

  return (
    <PlayerFrame
      {...frame}
      prev={prev}
      next={next}
      canRate={!data.isOwner && review.canReview && !review.mine}
      stage={
        video ? (
          <LessonVideo source={video} title={current.title} next={next} onDuration={current.durationSeconds ? undefined : reportLessonDuration.bind(null, id, current.id)} />
        ) : undefined
      }
      bar={
        <div className="et-pl-bar">
          <p>
            <small>{currentModule?.title}</small>
            <b>{current.title}</b>
          </p>
          <form action={setLessonDone}>
            <input type="hidden" name="lessonId" value={current.id} />
            <input type="hidden" name="done" value={current.done ? "0" : "1"} />
            {next && <input type="hidden" name="next" value={next.href} />}
            <button type="submit" className={`et-btn ${current.done ? "et-btn-success" : "et-btn-primary"}`} title={current.done ? "Click to mark as not done" : undefined}>
              <Check size={15} />
              {current.done ? "Completed" : quizNext ? "Complete and take the quiz" : next ? "Complete and continue" : "Mark complete"}
            </button>
          </form>
          {next && (
            <Link href={next.href} className="et-btn et-btn-ghost">
              {next.label} <ChevronRight size={15} />
            </Link>
          )}
        </div>
      }
      tabs={[
        { id: "overview", label: "Overview", content: overview },
        {
          id: "notes",
          label: "Notes",
          content: (
            <LessonNotes
              key={current.id}
              lessonId={current.id}
              initialBody={noteBy.get(current.id)?.body ?? ""}
              initialBookmarked={noteBy.get(current.id)?.bookmarked ?? false}
            />
          ),
        },
        ...(!data.isOwner ? [{ id: "reviews", label: "Reviews", content: <ReviewCard courseId={id} canReview={review.canReview} mine={review.mine} progress={progress} /> }] : []),
        ...(current && !isLocked
          ? [
              {
                id: "ai",
                label: "Ask AI",
                content: (
                  <AskAi
                    key={current.id}
                    courseId={id}
                    lessonId={current.id}
                    lessonTitle={current.title}
                    initial={(aiHistory ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))}
                    remaining={Math.max(0, LESSON_CHAT_DAILY_LIMIT - (aiUsed ?? 0))}
                  />
                ),
              },
            ]
          : []),
        { id: "support", label: "Support", content: support },
        { id: "announcements", label: "Announcements", content: announcements },
      ]}
    />
  );
}
