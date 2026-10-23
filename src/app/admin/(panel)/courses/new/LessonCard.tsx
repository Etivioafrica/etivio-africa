"use client";
import { useState } from "react";
import { aiLesson } from "@/app/(app)/teach/ai-actions";
import { ChevronDown, FileText, GripVertical, Paperclip, PlayCircle, Sparkles, Video, X } from "lucide-react";
import { RichTextEditor } from "@/components/dash/RichTextEditor";
import { Uploader } from "@/components/dash/Uploader";
import { formatBytes } from "@/lib/format";
import { videoEmbed } from "@/lib/video";
import { discardUpload, type LessonFile } from "../actions";
import { confirmDialog } from "@/components/dash/dialogs";

export type WizLesson = { key: number; id?: string; title: string; videoUrl: string; hostedVideo?: boolean; content: string; files: LessonFile[] };
export type LessonPatch = Partial<WizLesson> | ((l: WizLesson) => Partial<WizLesson>);

export const hasText = (html: string) => !!html.replace(/<[^>]*>/g, "").trim() || /<(img|iframe)/i.test(html);

// One lesson in the curriculum step: a title row that opens into its video link, text and files.
export function LessonCard({
  lesson,
  index,
  open,
  onToggle,
  onChange,
  onRemove,
  onEnter,
  ai,
}: {
  lesson: WizLesson;
  index: number;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: LessonPatch) => void;
  onRemove: () => void;
  onEnter: () => void;
  // Course context for "Draft with AI".
  ai?: { courseTitle: string; moduleTitle: string; level: string };
}) {
  const [uploaderKey, setUploaderKey] = useState(0);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  async function draft() {
    if (!ai) return;
    if (hasText(lesson.content) && !(await confirmDialog({ title: "Rewrite these notes with AI?", body: "It keeps your points and extends them.", confirmLabel: "Rewrite" }))) return;
    setDrafting(true);
    setDraftError("");
    const res = await aiLesson({ ...ai, lessonTitle: lesson.title, existing: lesson.content });
    setDrafting(false);
    if (res.ok) onChange({ content: res.data });
    else setDraftError(res.error);
  }
  const video = lesson.videoUrl.trim() ? videoEmbed(lesson.videoUrl.trim()) : null;
  const text = hasText(lesson.content);
  const empty = !lesson.videoUrl && !text && !lesson.files.length;

  function removeFile(f: LessonFile) {
    onChange((l) => ({ files: l.files.filter((x) => x.url !== f.url) }));
    // Saved files are removed on save; a file only uploaded in this session can go right away.
    if (!f.id) void discardUpload(f.url);
  }

  return (
    <>
      <div className="et-wiz-lesson-row">
        <GripVertical size={14} className="et-wiz-grip" />
        <input
          className="et-input"
          value={lesson.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={`Lesson ${index + 1} title`}
          aria-label={`Lesson ${index + 1} title`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        <span className="et-wiz-lesson-tags">
          {lesson.videoUrl && (
            <span className="et-tag">
              <PlayCircle size={11} /> Video
            </span>
          )}
          {text && (
            <span className="et-tag">
              <FileText size={11} /> Text
            </span>
          )}
          {lesson.files.length > 0 && (
            <span className="et-tag">
              <Paperclip size={11} /> {lesson.files.length}
            </span>
          )}
        </span>
        <button type="button" className={`et-btn et-btn-sm ${open ? "et-btn-primary" : "et-btn-ghost"}`} onClick={onToggle} aria-expanded={open}>
          {open ? "Done" : empty ? "Add content" : "Edit content"}
          <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : undefined }} />
        </button>
        <button type="button" className="et-icon-btn" onClick={onRemove} aria-label="Remove lesson">
          <X size={14} />
        </button>
      </div>

      {open && (
        <div className="et-wiz-lesson-body">
          <section>
            <h4>
              <Video size={14} /> Video <small>Optional</small>
            </h4>
            {lesson.hostedVideo ? (
              <div className="et-upload-file">
                <Video size={16} />
                <span>Uploaded video file</span>
                <button type="button" onClick={() => onChange({ videoUrl: "", hostedVideo: false })} aria-label="Remove video">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <input
                  className="et-input"
                  type="url"
                  value={lesson.videoUrl}
                  onChange={(e) => onChange({ videoUrl: e.target.value })}
                  placeholder="Paste a YouTube link, e.g. https://youtu.be/…"
                  aria-label="Video link"
                />
                <small className="et-wiz-help">YouTube, Vimeo or a direct MP4 link.</small>
              </>
            )}
            {lesson.videoUrl.trim() && !video && <p className="et-upload-err">That isn&apos;t a full link. It should start with https://</p>}
            {video && (
              <div className="et-wiz-video">
                {video.kind === "iframe" ? (
                  <iframe src={video.src} title={`${lesson.title || "Lesson"} video`} allow="encrypted-media; picture-in-picture" allowFullScreen />
                ) : (
                  <video src={video.src} controls preload="metadata" />
                )}
              </div>
            )}
          </section>

          <section>
            <h4>
              <FileText size={14} /> Text <small>Optional · notes, a reading, or a summary under the video</small>
              {ai && (
                <button type="button" className="et-btn et-btn-ghost et-btn-sm et-ai-inline" disabled={drafting || !lesson.title.trim()} onClick={draft}>
                  <Sparkles size={13} /> {drafting ? "Writing…" : hasText(lesson.content) ? "Improve with AI" : "Draft with AI"}
                </button>
              )}
            </h4>
            {draftError && <p className="et-ai-error">{draftError}</p>}
            <RichTextEditor value={lesson.content} onChange={(html) => onChange({ content: html })} />
          </section>

          <section>
            <h4>
              <Paperclip size={14} /> Files <small>Optional · slides, PDFs, worksheets learners can download</small>
            </h4>
            {lesson.files.length > 0 && (
              <div className="et-wiz-files">
                {lesson.files.map((f) => (
                  <div key={f.url} className="et-upload-file">
                    <Paperclip size={15} />
                    <span>{f.name}</span>
                    {f.size ? <small>{formatBytes(f.size)}</small> : null}
                    <button type="button" onClick={() => removeFile(f)} aria-label={`Remove ${f.name}`}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Uploader
              key={uploaderKey}
              name={`lesson-file-${lesson.key}`}
              kind="document"
              label={lesson.files.length ? "Attach another file" : "Click or drop a file to attach"}
              onUploaded={(f) => {
                onChange((l) => ({ files: [...l.files, f] }));
                setUploaderKey((k) => k + 1);
              }}
            />
          </section>
        </div>
      )}
    </>
  );
}
