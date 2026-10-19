"use client";
import { useState } from "react";
import Link from "next/link";
import { Clock, Heart, Layers, Sparkles, Star } from "lucide-react";
import { toggleSaved } from "@/app/(app)/learn/actions";

export type Tile = {
  id: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  href: string;
  // Filter keys this course belongs to, e.g. "beginner", "for-you", "in-progress".
  tags: string[];
  tagline?: string | null;
  forYou?: boolean;
  progress?: { value: number; left: string } | null;
  meta?: { by: string; lessons: number; rating?: number | null; reviews?: number; price: string } | null;
  // Undefined hides the heart (e.g. courses you're already enrolled in).
  saved?: boolean;
};

// Course cards with filter pills along the top. Filtering happens in the browser; every course is already loaded.
export function CourseTiles({ tiles, filters, empty }: { tiles: Tile[]; filters: { key: string; label: string }[]; empty: React.ReactNode }) {
  const [active, setActive] = useState("all");
  const shown = active === "all" ? tiles : tiles.filter((t) => t.tags.includes(active));
  if (!tiles.length) return empty;

  return (
    <>
      <div className="et-tile-filters" role="tablist" aria-label="Filter courses">
        {[{ key: "all", label: "All" }, ...filters].map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={active === f.key} className={active === f.key ? "is-on" : ""} onClick={() => setActive(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="et-tiles">
          {shown.map((t) => (
            <article key={t.id} className="et-tile">
              <div className="et-tile-top">
                <span className="et-tile-icon">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.coverUrl ? <img src={t.coverUrl} alt="" /> : <Layers size={26} strokeWidth={1.7} />}
                </span>
                {t.saved !== undefined && (
                  <form action={toggleSaved} className="et-tile-save">
                    <input type="hidden" name="courseId" value={t.id} />
                    <input type="hidden" name="saved" value={t.saved ? "1" : "0"} />
                    <button type="submit" className={t.saved ? "is-on" : ""} aria-pressed={t.saved} aria-label={t.saved ? "Remove from saved" : "Save for later"} data-tip={t.saved ? "Saved" : "Save for later"}>
                      <Heart size={15} fill={t.saved ? "currentColor" : "none"} />
                    </button>
                  </form>
                )}
              </div>
              {t.tagline && (
                <p className="et-course-tagline">
                  {t.forYou && <Sparkles size={12} />}
                  {t.tagline}
                </p>
              )}
              <h3>
                <Link href={t.href} className="et-tile-link">
                  {t.title}
                </Link>
              </h3>
              {t.summary && <p className="et-tile-summary">{t.summary}</p>}
              <div className="et-tile-foot">
                {t.progress ? (
                  <>
                    <span className="et-tile-bar">
                      <span style={{ width: `${t.progress.value}%` }} />
                    </span>
                    <small>
                      {t.progress.value}% complete <i>•</i> <Clock size={13} /> {t.progress.left}
                    </small>
                  </>
                ) : t.meta ? (
                  <small className="et-tile-meta">
                    <span>
                      {t.meta.by} <i>•</i> {t.meta.lessons} {t.meta.lessons === 1 ? "lesson" : "lessons"}
                      {t.meta.rating ? (
                        <em>
                          <Star size={12} fill="currentColor" /> {t.meta.rating.toFixed(1)} ({t.meta.reviews})
                        </em>
                      ) : null}
                    </span>
                    <b>{t.meta.price}</b>
                  </small>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="et-tile-none">No courses here yet. Try another filter.</p>
      )}
    </>
  );
}
