import Link from "next/link";
import { defaultAvatar } from "@/lib/avatars";
import { Cover } from "@/components/dash/ui";
import { formatPrice } from "@/lib/format";
import { ArrowRight, BookOpen, Heart, Sparkles, Star } from "lucide-react";
import { enrollFree, toggleSaved } from "@/app/(app)/learn/actions";
import type { CourseCard } from "@/lib/data/learn";

export function CourseGrid({ courses, enrolledIds, savedIds }: { courses: (CourseCard & { reason?: string | null })[]; enrolledIds: Set<string>; savedIds?: Set<string> }) {
  return (
    <div className="et-course-grid">
      {courses.map((c) => {
        const enrolled = enrolledIds.has(c.id);
        const saved = savedIds?.has(c.id) ?? false;
        return (
          <article key={c.id} className="et-card et-course et-ccard">
            {/* The whole card opens the course; the save and enroll buttons sit above this link. */}
            <Link href={enrolled ? `/learn/course/${c.id}` : `/learn/browse/${c.id}`} className="et-ccard-link" aria-label={enrolled ? `Continue ${c.title}` : `View ${c.title}`} />
            <div className="et-ccard-media">
              <Cover url={c.coverUrl} />
              <span className="et-ccard-level">{c.level}</span>
              {savedIds && !enrolled && (
                <form action={toggleSaved} className="et-ccard-save">
                  <input type="hidden" name="courseId" value={c.id} />
                  <input type="hidden" name="saved" value={saved ? "1" : "0"} />
                  <button type="submit" className={`et-save${saved ? " is-on" : ""}`} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save for later"} data-tip={saved ? "Saved" : "Save for later"}>
                    <Heart size={15} fill={saved ? "currentColor" : "none"} />
                  </button>
                </form>
              )}
            </div>
            <div className="et-ccard-body">
              {(c.reason || c.category) && (
                <p className="et-ccard-eyebrow">
                  {c.reason ? <Sparkles size={12} /> : null}
                  {c.reason ?? c.category}
                </p>
              )}
              <h3>{c.title}</h3>
              <p className="et-ccard-by">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={defaultAvatar(c.instructor)} alt="" className="et-ccard-avatar" />
                {c.instructor}
              </p>
              <p className="et-ccard-meta">
                <span>
                  <BookOpen size={13} /> {c.lessonCount} {c.lessonCount === 1 ? "lesson" : "lessons"}
                </span>
                {c.rating ? (
                  <span className="et-ccard-rating">
                    <Star size={13} fill="currentColor" /> {c.rating.toFixed(1)} <small>({c.reviews})</small>
                  </span>
                ) : null}
              </p>
            </div>
            <div className="et-ccard-foot">
              {enrolled ? (
                <span className="et-ccard-owned">Enrolled</span>
              ) : c.priceMinor === 0 ? (
                <span className="et-ccard-free">Free</span>
              ) : (
                <b className="et-ccard-price">{formatPrice(c.priceMinor, c.currency)}</b>
              )}
              {enrolled ? (
                <Link href={`/learn/course/${c.id}`} className="et-btn et-btn-primary et-btn-sm">
                  Continue <ArrowRight size={14} />
                </Link>
              ) : c.priceMinor === 0 ? (
                <form action={enrollFree}>
                  <input type="hidden" name="courseId" value={c.id} />
                  <button type="submit" className="et-btn et-btn-primary et-btn-sm">
                    Enroll
                  </button>
                </form>
              ) : (
                <Link href={`/courses/${c.slug}`} className="et-btn et-btn-primary et-btn-sm">
                  Buy now
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
