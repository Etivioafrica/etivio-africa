"use client";
import { useRef, useState, useTransition } from "react";
import { AlertCircle, CalendarClock, ImagePlus, Trash2, X } from "lucide-react";
import { RichTextEditor } from "@/components/dash/RichTextEditor";
import { Select } from "@/components/dash/Select";
import { CropUpload, type CropUploadHandle } from "@/components/dash/CropUpload";
import { stripHtml, type Announcement } from "@/lib/announcements";
import { createAnnouncement, deleteAnnouncement, updateAnnouncement, type AnnouncementInput } from "./actions";

type PanelStatus = "draft" | "scheduled" | "published" | "archived";

const STATUSES: { value: PanelStatus; label: string; cls: string }[] = [
  { value: "draft", label: "Draft", cls: "is-amber" },
  { value: "scheduled", label: "Scheduled", cls: "is-blue" },
  { value: "published", label: "Published", cls: "is-green" },
];

const pad = (n: number) => String(n).padStart(2, "0");
// <input type="datetime-local"> works in local time without a zone.
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

type Props = {
  open: boolean;
  onClose: () => void;
  editing: Announcement | null;
  onSaved: (a: Announcement) => void;
  onDeleted: (id: string) => void;
  courses: { id: string; title: string }[];
};

// The panel remounts per open (keyed below), so its fields always start from the announcement being edited.
export function AnnouncementPanel(props: Props) {
  if (!props.open) return null;
  return <PanelBody key={props.editing?.id ?? "new"} {...props} />;
}

function PanelBody({ onClose, editing, onSaved, onDeleted, courses }: Props) {
  const cover = useRef<CropUploadHandle>(null);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [status, setStatus] = useState<PanelStatus>(editing?.status ?? "draft");
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInput(editing?.scheduled_at ? new Date(editing.scheduled_at) : new Date(Date.now() + 60 * 60 * 1000)));
  const [pinned, setPinned] = useState(editing?.pinned ?? false);
  const [courseId, setCourseId] = useState(editing?.course_id ?? "");
  const [coverImage, setCoverImage] = useState(editing?.cover_image_url ?? "");
  const [coverVideo, setCoverVideo] = useState(editing?.cover_video_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const canSave = title.trim() && stripHtml(body) && !saving;

  function save() {
    if (status === "scheduled" && new Date(scheduledAt).getTime() <= Date.now()) return setError("Scheduled time must be in the future.");
    setError(null);
    const input: AnnouncementInput = {
      title,
      body,
      status,
      pinned,
      scheduled_at: status === "scheduled" ? new Date(scheduledAt).toISOString() : null,
      cover_image_url: coverImage || null,
      cover_video_url: coverVideo || null,
      course_id: courseId || null,
    };
    startSaving(async () => {
      const res = editing ? await updateAnnouncement(editing.id, input) : await createAnnouncement(input);
      if (res.error || !res.data) return setError(res.error ?? "Something went wrong.");
      onSaved(res.data);
    });
  }

  function remove() {
    if (!editing || !window.confirm(`Delete "${editing.title}"? This can't be undone.`)) return;
    startDeleting(async () => {
      const res = await deleteAnnouncement(editing.id);
      if (res.error) return setError(res.error);
      onDeleted(editing.id);
    });
  }

  return (
    <>
      <button type="button" className="et-drawer-scrim" aria-label="Close" onClick={onClose} />
      <aside className="et-drawer" role="dialog" aria-modal="true" aria-label={editing ? "Edit announcement" : "New announcement"}>
        <div className="et-drawer-head">
          <h2>{editing ? "Edit announcement" : "New announcement"}</h2>
          <button type="button" className="et-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="et-drawer-body">
          {error && (
            <p className="et-flash et-flash-err" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </p>
          )}

          <div className="et-field">
            <label htmlFor="ann-title">Title</label>
            <input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title…" maxLength={160} />
          </div>

          <div className="et-field">
            <label>Content</label>
            <RichTextEditor value={body} onChange={setBody} />
          </div>

          <div className="et-field">
            <label>
              Cover media <span className="et-muted">(optional)</span>
            </label>
            <div className="et-ann-cover">
              <button type="button" className="et-ann-cover-thumb" onClick={() => cover.current?.open()} aria-label="Choose cover image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {coverImage ? <img src={coverImage} alt="" /> : <ImagePlus size={20} />}
              </button>
              <div className="et-inline">
                <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => cover.current?.open()}>
                  {coverImage ? "Change image" : "Add cover image"}
                </button>
                {coverImage && (
                  <button type="button" className="et-btn et-btn-danger-text et-btn-sm" onClick={() => setCoverImage("")}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            <input value={coverVideo} onChange={(e) => setCoverVideo(e.target.value)} placeholder="Cover video: https://youtube.com/watch?v=…" inputMode="url" />
            <small>A YouTube cover video shows instead of the image.</small>
          </div>

          <div className="et-field">
            <label>Status</label>
            <div className="et-ann-status">
              {STATUSES.map((s) => (
                <button key={s.value} type="button" className={`${s.cls}${status === s.value ? " is-on" : ""}`} onClick={() => setStatus(s.value)} aria-pressed={status === s.value}>
                  {s.label}
                </button>
              ))}
            </div>
            {editing?.status === "archived" && status === "archived" && <small>This announcement is archived. Pick a status to bring it back.</small>}
            {status === "scheduled" && (
              <label className="et-ann-schedule">
                <CalendarClock size={16} />
                <span>
                  <small>Publish at</small>
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </span>
              </label>
            )}
          </div>

          <div className="et-field">
            <label htmlFor="ann-audience">Who gets it</label>
            <Select id="ann-audience" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Everyone on Etivio</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  Learners in {c.title}
                </option>
              ))}
            </Select>
            <small>{courseId ? "Only learners enrolled in this course see it and get the email." : "Every learner sees it and gets the email."}</small>
          </div>

          <label className="et-set-box et-set-box-row" style={{ cursor: "pointer" }}>
            <span>
              <b>Pin announcement</b>
              <small>Show at the top of the feed.</small>
            </span>
            <input type="checkbox" role="switch" className="et-toggle" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          </label>

          {editing && editing.status !== "archived" && (
            <button type="button" className="et-btn et-btn-ghost et-btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setStatus("archived")}>
              Archive (hide from learners)
            </button>
          )}
        </div>

        <div className="et-drawer-foot">
          {editing && (
            <button type="button" className="et-icon-btn et-ann-delete" onClick={remove} disabled={deleting} aria-label="Delete announcement">
              <Trash2 size={16} />
            </button>
          )}
          <button type="button" className="et-btn et-btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="et-btn et-btn-primary"
            style={{ flex: 1 }}
            onClick={save}
            disabled={!canSave}
            title={canSave ? undefined : "Add a title and some content first"}
          >
            {saving ? "Saving…" : status === "scheduled" ? "Schedule" : status === "draft" ? "Save draft" : editing ? "Save changes" : "Publish"}
          </button>
        </div>

        <CropUpload
          ref={cover}
          kind="blog"
          out={{ width: 1080, height: 1080 }}
          title="Announcement cover"
          hint="Square images work best. JPG, PNG, or WebP, up to 20 MB."
          confirmLabel="Use this image"
          onUploaded={async (url) => {
            setCoverImage(url);
            return {};
          }}
        />
      </aside>
    </>
  );
}
