"use client";
import { videoEmbed } from "@/lib/video";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, Download, FileText, Link2, Paperclip, PlayCircle, Trash2, X } from "lucide-react";
import { RichTextEditor } from "@/components/dash/RichTextEditor";
import { Uploader, type Uploaded } from "@/components/dash/Uploader";
import { useToast } from "@/components/dash/useToast";
import { formatBytes } from "@/lib/format";
import { addLessonResource, deleteLessonFromEditor, removeLessonResource, saveLessonFull, type LessonInput } from "../../../actions";
import { Select } from "@/components/dash/Select";
import { confirmDialog } from "@/components/dash/dialogs";

type Resource = { id: string; title: string; file_url: string; file_name: string | null; file_size: number | null; mime_type: string | null };
type Nav = { id: string; title: string } | null;


export function LessonEditor({
  course,
  modules,
  lesson,
  resources: initialResources,
  position,
  hostedVideo,
}: {
  course: { id: string; title: string };
  modules: { id: string; title: string }[];
  lesson: LessonInput & { id: string };
  resources: Resource[];
  position: { index: number; total: number; prev: Nav; next: Nav };
  // True when the video was uploaded to Etivio's storage rather than linked.
  hostedVideo: boolean;
}) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [saving, start] = useTransition();
  const [form, setForm] = useState<LessonInput>(lesson);
  const [dirty, setDirty] = useState(false);
  const [resources, setResources] = useState(initialResources);
  const [resTitle, setResTitle] = useState("");
  const [uploaderKey, setUploaderKey] = useState(0);
  const [hosted, setHosted] = useState(hostedVideo);
  const [linkMode, setLinkMode] = useState(!!lesson.videoUrl && !hostedVideo);
  const set = (patch: Partial<LessonInput>) => {
    setDirty(true);
    setForm((f) => ({ ...f, ...patch }));
  };
  const video = form.kind === "video" && form.videoUrl ? videoEmbed(form.videoUrl) : null;
  const base = `/admin/courses/${course.id}`;

  function save(then?: string) {
    start(async () => {
      const res = await saveLessonFull(lesson.id, form);
      show(res);
      if (res.error) return;
      setDirty(false);
      if (then) router.push(then);
    });
  }

  // Read the uploaded video's length so the duration fills itself in.
  function onVideo(file: Uploaded) {
    setHosted(true);
    set({ videoUrl: file.url });
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => Number.isFinite(v.duration) && v.duration > 0 && set({ videoUrl: file.url, minutes: String(Math.max(1, Math.round(v.duration / 60))) });
    v.src = file.url;
  }

  function onResource(file: Uploaded) {
    start(async () => {
      const res = await addLessonResource(lesson.id, file, resTitle);
      show(res);
      if (res.id) setResources((r) => [...r, { id: res.id!, title: (resTitle.trim() || file.name).slice(0, 160), file_url: file.url, file_name: file.name, file_size: file.size, mime_type: file.type }]);
      setResTitle("");
      setUploaderKey((k) => k + 1);
    });
  }

  const go = (to: Nav) => to && (dirty ? save(`${base}/lessons/${to.id}`) : router.push(`${base}/lessons/${to.id}`));

  return (
    <>
      {toast}
      <p className="et-set-crumb">
        <BookOpen size={12} />
        <Link href="/admin/courses">Courses</Link> <span>/</span> <Link href={`${base}?tab=curriculum`}>{course.title}</Link> <span>/</span> Lesson {position.index} of {position.total}
      </p>
      <div className="et-page-head">
        <div>
          <h1>{form.title || "Untitled lesson"}</h1>
          <p>{modules.find((m) => m.id === form.moduleId)?.title}</p>
        </div>
        <div className="et-inline">
          <button type="button" className="et-btn et-btn-ghost" disabled={!position.prev || saving} onClick={() => go(position.prev)} title={position.prev?.title}>
            <ChevronLeft size={15} /> Previous
          </button>
          <button type="button" className="et-btn et-btn-ghost" disabled={!position.next || saving} onClick={() => go(position.next)} title={position.next?.title}>
            Next <ChevronRight size={15} />
          </button>
          <button type="button" className="et-btn et-btn-primary" onClick={() => save()} disabled={saving}>
            {saving ? "Saving…" : dirty ? "Save lesson" : "Saved"}
          </button>
        </div>
      </div>

      <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className="et-lesson-kind" role="radiogroup" aria-label="Lesson type">
            <button type="button" role="radio" aria-checked={form.kind === "video"} className={form.kind === "video" ? "is-on" : ""} onClick={() => set({ kind: "video" })}>
              <PlayCircle size={20} />
              <span>
                <b>Video</b>
                <small>A video, with optional notes underneath</small>
              </span>
            </button>
            <button type="button" role="radio" aria-checked={form.kind === "reading"} className={form.kind === "reading" ? "is-on" : ""} onClick={() => set({ kind: "reading" })}>
              <FileText size={20} />
              <span>
                <b>Reading</b>
                <small>An article: text, images, links and embeds</small>
              </span>
            </button>
          </div>

          {form.kind === "video" && (
            <section className="et-card">
              <div className="et-card-head">
                <h2>Video</h2>
                <nav className="et-seg">
                  <button type="button" className={!linkMode ? "is-on" : ""} onClick={() => setLinkMode(false)}>
                    Upload
                  </button>
                  <button type="button" className={linkMode ? "is-on" : ""} onClick={() => setLinkMode(true)}>
                    <Link2 size={12} /> Link
                  </button>
                </nav>
              </div>
              <div className="et-card-pad et-form">
                {video && (
                  <div className="et-video et-lesson-preview">
                    {video.kind === "iframe" ? <iframe src={video.src} title="Video preview" allow="fullscreen; picture-in-picture" allowFullScreen /> : <video src={video.src} controls preload="metadata" />}
                  </div>
                )}
                {linkMode ? (
                  <div className="et-field">
                    <label htmlFor="v-link">Video link</label>
                    <input id="v-link" type="url" value={form.videoUrl} onChange={(e) => {
                        setHosted(false);
                        set({ videoUrl: e.target.value });
                      }}
                      placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…" />
                    <small>YouTube, Vimeo or a direct MP4 link.</small>
                  </div>
                ) : (
                  <Uploader key={form.videoUrl ? "has" : "none"} name="video" kind="video" defaultUrl={hosted ? form.videoUrl : null} label="Upload a video (MP4 works best, up to 2 GB)" onUploaded={onVideo} />
                )}
                {form.videoUrl && (
                  <button type="button" className="et-btn et-btn-ghost et-btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => set({ videoUrl: "" })}>
                    <X size={13} /> Remove video
                  </button>
                )}
              </div>
            </section>
          )}

          <section className="et-card">
            <div className="et-card-head">
              <h2>{form.kind === "reading" ? "Reading" : "Notes under the video"}</h2>
              <small className="et-muted">{form.kind === "reading" ? "This is the lesson." : "Optional: key points, links, transcript."}</small>
            </div>
            <div className="et-card-pad">
              <RichTextEditor value={form.content} onChange={(html) => set({ content: html })} />
            </div>
          </section>

          <section className="et-card">
            <div className="et-card-head">
              <h2>
                <Paperclip size={15} /> Resources
              </h2>
              <small className="et-muted">Files learners can download with this lesson: slides, worksheets, templates.</small>
            </div>
            {resources.length > 0 && (
              <ul className="et-res-list">
                {resources.map((r) => (
                  <li key={r.id}>
                    <span className="et-res-icon">
                      <FileText size={16} />
                    </span>
                    <span>
                      <b>{r.title}</b>
                      <small>
                        {r.file_name}
                        {r.file_size ? ` · ${formatBytes(r.file_size)}` : ""}
                      </small>
                    </span>
                    <a href={r.file_url} target="_blank" rel="noreferrer" className="et-icon-btn" aria-label="Download">
                      <Download size={14} />
                    </a>
                    <button
                      type="button"
                      className="et-icon-btn is-danger"
                      aria-label="Remove"
                      onClick={async () =>
                        (await confirmDialog({ title: `Remove "${r.title}"?`, confirmLabel: "Remove", danger: true })) &&
                        start(async () => {
                          show(await removeLessonResource(r.id));
                          setResources((x) => x.filter((y) => y.id !== r.id));
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="et-card-pad et-form">
              <div className="et-field">
                <label htmlFor="r-title">Name (optional)</label>
                <input id="r-title" value={resTitle} onChange={(e) => setResTitle(e.target.value)} placeholder="e.g. Lesson slides" maxLength={160} />
              </div>
              <Uploader key={uploaderKey} name="resource" kind="document" label="Upload a file (PDF, slides, spreadsheet, zip)" onUploaded={onResource} />
            </div>
          </section>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="et-card et-card-pad et-form">
            <div className="et-field">
              <label htmlFor="l-title">Lesson title</label>
              <input id="l-title" value={form.title} maxLength={160} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="et-field">
              <label htmlFor="l-mod">Module</label>
              <Select id="l-mod" value={form.moduleId} onChange={(e) => set({ moduleId: e.target.value })}>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="et-field">
              <label htmlFor="l-min">{form.kind === "reading" ? "Reading time (minutes)" : "Length (minutes)"}</label>
              <input id="l-min" type="number" min={0} value={form.minutes} onChange={(e) => set({ minutes: e.target.value })} placeholder={form.kind === "video" ? "Fills in when you upload" : "e.g. 5"} />
            </div>
            <label className="et-check">
              <input type="checkbox" checked={form.isPreview} onChange={(e) => set({ isPreview: e.target.checked })} />
              <span>
                <b style={{ color: "var(--a-fg)" }}>Free preview</b>
                <br />
                <small>Anyone can watch or read it before enrolling.</small>
              </span>
            </label>
          </section>
          <section className="et-card et-card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <small className="et-muted">Deleting removes learners&apos; progress and notes for this lesson.</small>
            <button
              type="button"
              className="et-btn et-btn-sm et-btn-danger-text"
              disabled={saving}
              onClick={async () =>
                (await confirmDialog({ title: "Delete this lesson?", body: "Learners lose their progress and notes on it.", confirmLabel: "Delete", danger: true })) &&
                start(async () => {
                  await deleteLessonFromEditor(lesson.id);
                  router.push(`${base}?tab=curriculum`);
                })
              }
            >
              <Trash2 size={14} /> Delete
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
