import Link from "next/link";
import { Cover } from "@/components/dash/ui";
import { formatPrice } from "@/lib/format";
import { Heart, Sparkles, Star } from "lucide-react";
import { enrollFree, toggleSaved } from "@/app/(app)/learn/actions";
import type { CourseCard } from "@/lib/data/learn";

export function CourseGrid({ courses, enrolledIds, savedIds }: { courses: (CourseCard & { reason?: string | null })[]; enrolledIds: Set<string>; savedIds?: Set<string> }) {
  return (
    <div className="et-course-grid">
      {courses.map((c) => {
        const enrolled = enrolledIds.has(c.id);
        const saved = savedIds?.has(c.id) ?? false;
        return (
          <article key={c.id} className="et-card et-course">
            <div className="et-course-media">
              <Link href={`/learn/browse/${c.id}`} className="et-course-link" aria-label={`View ${c.title}`}>
                <Cover url={c.coverUrl} level={c.level} />
              </Link>
              {savedIds && !enrolled && (
                <form action={toggleSaved}>
                  <input type="hidden" name="courseId" value={c.id} />
                  <input type="hidden" name="saved" value={saved ? "1" : "0"} />
                  <button type="submit" className={`et-save${saved ? " is-on" : ""}`} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save for later"} data-tip={saved ? "Saved" : "Save for later"}>
                    <Heart size={16} />
                  </button>
                </form>
              )}
            </div>
            <div className="et-course-body">
              {(c.reason || c.category) && (
                <p className="et-course-tagline">
                  {c.reason ? <Sparkles size={12} /> : null}
                  {c.reason ?? c.category}
                </p>
              )}
              <h3>
                <Link href={`/learn/browse/${c.id}`}>{c.title}</Link>
              </h3>
              {c.summary && <p>{c.summary}</p>}
              <div className="et-course-meta">
                <span>
                  {c.instructor} · {c.lessonCount} lessons
                  {c.rating ? (
                    <em className="et-card-rating">
                      <Star size={12} fill="currentColor" /> {c.rating.toFixed(1)} ({c.reviews})
                    </em>
                  ) : null}
                </span>
                <b>{formatPrice(c.priceMinor, c.currency)}</b>
              </div>
            </div>
            <div className="et-course-foot">
              {!enrolled && (
                <Link href={`/learn/browse/${c.id}`} className="et-btn et-btn-ghost">
                  Details
                </Link>
              )}
              {enrolled ? (
                <Link href={`/learn/course/${c.id}`} className="et-btn et-btn-ghost">
                  Continue
                </Link>
              ) : c.priceMinor === 0 ? (
                <form action={enrollFree}>
                  <input type="hidden" name="courseId" value={c.id} />
                  <button type="submit" className="et-btn et-btn-primary">
                    Enroll for free
                  </button>
                </form>
              ) : (
                <button className="et-btn et-btn-ghost" disabled data-tip="Paid checkout is coming soon">
                  Enroll
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
