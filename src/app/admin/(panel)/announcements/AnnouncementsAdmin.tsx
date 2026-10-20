"use client";
import { useState } from "react";
import { Eye, Megaphone, PenLine, Pin, Plus } from "lucide-react";
import { stripHtml, type Announcement } from "@/lib/announcements";
import { AnnouncementPanel } from "./AnnouncementPanel";

const FILTERS = ["all", "published", "scheduled", "draft", "archived"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_CLASS: Record<string, string> = {
  published: "et-status-green",
  scheduled: "et-status-blue",
  draft: "et-status-amber",
  archived: "et-status-grey",
};

const when = (a: Announcement) =>
  a.status === "scheduled" && a.scheduled_at
    ? `Scheduled for ${new Date(a.scheduled_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function AnnouncementsAdmin({ announcements: initial, courses }: { announcements: Announcement[]; courses: { id: string; title: string }[] }) {
  const [list, setList] = useState(initial);
  const courseTitle = new Map(courses.map((c) => [c.id, c.title]));
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = filter === "all" ? list : list.filter((a) => a.status === filter);
  const count = (s: string) => list.filter((a) => a.status === s).length;

  function openCreate() {
    setEditing(null);
    setPanelOpen(true);
  }
  function openEdit(a: Announcement) {
    setEditing(a);
    setPanelOpen(true);
  }
  function onSaved(saved: Announcement) {
    setList((prev) => {
      const i = prev.findIndex((a) => a.id === saved.id);
      if (i === -1) return [saved, ...prev];
      const next = [...prev];
      next[i] = saved;
      return next;
    });
    setPanelOpen(false);
  }
  function onDeleted(id: string) {
    setList((prev) => prev.filter((a) => a.id !== id));
    setPanelOpen(false);
  }

  return (
    <>
      <AnnouncementPanel open={panelOpen} onClose={() => setPanelOpen(false)} editing={editing} onSaved={onSaved} onDeleted={onDeleted} courses={courses} />

      <div className="et-page">
        <div className="et-page-head">
          <div>
            <h1>Announcements</h1>
            <p>Keep your learners informed.</p>
          </div>
          <button type="button" className="et-btn et-btn-primary" onClick={openCreate}>
            <Plus size={15} /> New announcement
          </button>
        </div>

        <div className="et-statstrip">
          {[
            { label: "Total", value: list.length },
            { label: "Published", value: count("published") },
            { label: "Drafts", value: count("draft") },
            { label: "Pinned", value: list.filter((a) => a.pinned).length },
          ].map((x) => (
            <div key={x.label} className="et-card" style={{ display: "block" }}>
              <p>{x.label}</p>
              <strong>{x.value}</strong>
            </div>
          ))}
        </div>

        <nav className="et-seg" aria-label="Filter announcements" style={{ width: "max-content" }}>
          {FILTERS.map((f) => (
            <button key={f} type="button" className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)} style={{ textTransform: "capitalize" }}>
              {f}
            </button>
          ))}
        </nav>

        {filtered.length === 0 ? (
          <section className="et-card">
            <div className="et-empty-mini" style={{ padding: "56px 20px" }}>
              <span className="et-empty-mini-icon">
                <PenLine size={18} />
              </span>
              <b>No announcements yet</b>
              <p>Create your first announcement to keep your learners informed.</p>
              <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={openCreate}>
                Create announcement
              </button>
            </div>
          </section>
        ) : (
          <div className="et-ann-admin-list">
            {filtered.map((a) => (
              <button key={a.id} type="button" className="et-card et-ann-admin-row" onClick={() => openEdit(a)}>
                {a.pinned ? <Pin size={15} className="et-ann-pin" fill="currentColor" /> : <Megaphone size={15} className="et-muted" />}
                <span className="et-ann-admin-main">
                  <span className="et-ann-admin-title">
                    <b>{a.title}</b>
                    <span className={`et-status ${STATUS_CLASS[a.status]}`}>{a.status}</span>
                  </span>
                  <small className="et-ann-excerpt">{stripHtml(a.body)}</small>
                  <small className="et-muted">
                    {when(a)} · {a.course_id ? `Learners in ${courseTitle.get(a.course_id) ?? "a course"}` : "Everyone"}
                  </small>
                </span>
                <Eye size={15} className="et-muted" />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
