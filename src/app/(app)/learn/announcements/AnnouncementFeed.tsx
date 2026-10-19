"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, LayoutGrid, List, Megaphone, PlayCircle, Pin } from "lucide-react";
import { formatAnnouncementDate, getYoutubeThumbnail, liveDate, stripHtml, type Announcement, type ViewMode } from "@/lib/announcements";

const coverOf = (a: Announcement) => (a.cover_video_url ? getYoutubeThumbnail(a.cover_video_url) : null) ?? a.cover_image_url;

function Card({ a }: { a: Announcement }) {
  const cover = coverOf(a);
  return (
    <Link href={`/learn/announcements/${a.id}`} className={`et-card et-ann-card${a.pinned ? " is-pinned" : ""}`}>
      {cover && (
        <span className="et-ann-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" />
          {a.cover_video_url && (
            <span className="et-ann-play">
              <PlayCircle size={44} />
            </span>
          )}
        </span>
      )}
      <span className="et-ann-card-body">
        <span className="et-ann-card-title">
          {a.pinned && <Pin size={13} fill="currentColor" className="et-ann-pin" />}
          <b>{a.title}</b>
        </span>
        <small className="et-ann-excerpt">{stripHtml(a.body)}</small>
        <span className="et-ann-card-foot">
          <small>{formatAnnouncementDate(liveDate(a))}</small>
          <span className="et-ann-more">
            Read more <ArrowRight size={12} />
          </span>
        </span>
      </span>
    </Link>
  );
}

function Row({ a }: { a: Announcement }) {
  const cover = coverOf(a);
  return (
    <Link href={`/learn/announcements/${a.id}`} className={`et-card et-ann-row${a.pinned ? " is-pinned" : ""}`}>
      <span className="et-ann-row-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={cover} alt="" /> : <Megaphone size={20} />}
        {cover && a.cover_video_url && <PlayCircle size={20} className="et-ann-row-play" />}
      </span>
      <span className="et-ann-row-main">
        <span className="et-ann-card-title">
          {a.pinned && <Pin size={12} fill="currentColor" className="et-ann-pin" />}
          <b>{a.title}</b>
        </span>
        <small className="et-ann-excerpt is-one">{stripHtml(a.body)}</small>
      </span>
      <small className="et-hide-sm et-muted">{formatAnnouncementDate(liveDate(a))}</small>
      <ArrowRight size={14} className="et-ann-more" />
    </Link>
  );
}

function Items({ items, mode }: { items: Announcement[]; mode: ViewMode }) {
  return mode === "grid" ? (
    <div className="et-ann-grid">
      {items.map((a) => (
        <Card key={a.id} a={a} />
      ))}
    </div>
  ) : (
    <div className="et-ann-list">
      {items.map((a) => (
        <Row key={a.id} a={a} />
      ))}
    </div>
  );
}

// Learner feed: pinned first, then latest, in a grid or list (remembered in the URL as ?view=list).
export function AnnouncementFeed({ announcements, initialViewMode }: { announcements: Announcement[]; initialViewMode: ViewMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<ViewMode>(initialViewMode);

  function change(m: ViewMode) {
    setMode(m);
    router.replace(`${pathname}${m === "list" ? "?view=list" : ""}`, { scroll: false });
  }

  if (!announcements.length)
    return (
      <div className="et-page">
        <div className="et-page-head">
          <div>
            <h1>Announcements</h1>
            <p>Stay up to date with the latest from Etivio.</p>
          </div>
        </div>
        <section className="et-card">
          <div className="et-empty-mini" style={{ padding: "64px 20px" }}>
            <span className="et-empty-mini-icon">
              <Megaphone size={18} />
            </span>
            <b>No announcements yet</b>
            <p>Check back soon for updates.</p>
          </div>
        </section>
      </div>
    );

  const pinned = announcements.filter((a) => a.pinned);
  const latest = announcements.filter((a) => !a.pinned);

  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>Announcements</h1>
          <p>
            {announcements.length} announcement{announcements.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="et-view-toggle" role="group" aria-label="Layout">
          <button type="button" aria-label="Grid view" aria-pressed={mode === "grid"} className={mode === "grid" ? "is-on" : ""} onClick={() => change("grid")}>
            <LayoutGrid size={16} />
          </button>
          <button type="button" aria-label="List view" aria-pressed={mode === "list"} className={mode === "list" ? "is-on" : ""} onClick={() => change("list")}>
            <List size={16} />
          </button>
        </div>
      </div>

      {pinned.length > 0 && (
        <section className="et-ann-section">
          <p className="et-section-label">Pinned</p>
          <Items items={pinned} mode={mode} />
        </section>
      )}
      {latest.length > 0 && (
        <section className="et-ann-section">
          {pinned.length > 0 && <p className="et-section-label">Latest</p>}
          <Items items={latest} mode={mode} />
        </section>
      )}
    </div>
  );
}
