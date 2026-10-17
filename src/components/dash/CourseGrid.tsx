import Link from "next/link";
import { Cover } from "@/components/dash/ui";
import { formatPrice } from "@/lib/format";
import { enrollFree } from "@/app/(app)/learn/actions";
import type { CourseCard } from "@/lib/data/learn";

export function CourseGrid({ courses, enrolledIds }: { courses: CourseCard[]; enrolledIds: Set<string> }) {
  return (
    <div className="et-course-grid">
      {courses.map((c) => {
        const enrolled = enrolledIds.has(c.id);
        return (
          <article key={c.id} className="et-card et-course">
            <Cover url={c.coverUrl} level={c.level} />
            <div className="et-course-body">
              <h3>{c.title}</h3>
              {c.summary && <p>{c.summary}</p>}
              <div className="et-course-meta">
                <span>
                  {c.instructor} · {c.lessonCount} lessons
                </span>
                <b>{formatPrice(c.priceMinor, c.currency)}</b>
              </div>
            </div>
            <div className="et-course-foot">
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
