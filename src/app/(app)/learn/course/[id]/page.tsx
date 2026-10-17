import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Download, FileText, PlayCircle } from "lucide-react";
import { Progress } from "@/components/dash/ui";
import { getCoursePlayer } from "@/lib/data/learn";
import { formatBytes, formatDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { setLessonDone } from "../../actions";

export const metadata = { title: "Course" };

// Turn YouTube/Vimeo page links into embeddable URLs; anything else plays as a file.
function embed(url: string): { kind: "iframe" | "video"; src: string } {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: "video", src: url };
}

export default async function CoursePlayer({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const [{ id }, { lesson: lessonParam }] = await Promise.all([params, searchParams]);
  const data = await getCoursePlayer(id);
  if (!data) notFound();

  const { course, modules, lessons, doneCount, progress } = data;
  // RLS limits this to documents the viewer may open (enrolled, owner, or public).
  const { data: docs } = await (await createClient())
    .from("documents")
    .select("id, title, description, file_url, file_name, file_size")
    .eq("course_id", id)
    .neq("visibility", "private")
    .order("created_at");
  const current = lessons.find((l) => l.id === lessonParam) ?? lessons.find((l) => !l.done) ?? lessons[0];
  const idx = current ? lessons.indexOf(current) : -1;
  const next = idx >= 0 ? lessons[idx + 1] : undefined;
  const base = `/learn/course/${id}`;
  const video = current?.videoUrl ? embed(current.videoUrl) : null;

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
          <Progress value={progress} label={`${doneCount}/${lessons.length}`} />
        </div>
      </div>

      <div className="et-grid-main">
        <section className="et-card">
          {current ? (
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
                {current.content ? (
                  <div className="et-prose">{current.content}</div>
                ) : (
                  !video && <p style={{ color: "var(--a-faint)" }}>This lesson has no content yet.</p>
                )}
              </div>
              <div className="et-lesson-foot">
                <form action={setLessonDone}>
                  <input type="hidden" name="lessonId" value={current.id} />
                  <input type="hidden" name="done" value={current.done ? "0" : "1"} />
                  {next && <input type="hidden" name="next" value={`${base}?lesson=${next.id}`} />}
                  <button type="submit" className={`et-btn ${current.done ? "et-btn-success" : "et-btn-primary"}`}>
                    <Check size={15} />
                    {current.done ? "Completed" : next ? "Mark complete and continue" : "Mark complete"}
                  </button>
                </form>
                {next && (
                  <Link href={`${base}?lesson=${next.id}`} className="et-btn et-btn-ghost">
                    Next lesson
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
                  <span>{m.title}</span>
                  <small>{m.lessons.length} lessons</small>
                </div>
                {m.lessons.map((l) => (
                  <Link
                    key={l.id}
                    href={`${base}?lesson=${l.id}`}
                    className={`et-lesson${l.id === current?.id ? " is-active" : ""}`}
                  >
                    <span className={`et-lesson-dot${l.done ? " is-done" : ""}`}>
                      {l.done ? <Check size={11} strokeWidth={3} /> : null}
                    </span>
                    <span className="et-lesson-title">{l.title}</span>
                    {l.videoUrl && <PlayCircle size={14} />}
                    {l.durationSeconds ? <small>{formatDuration(l.durationSeconds)}</small> : null}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </aside>
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
