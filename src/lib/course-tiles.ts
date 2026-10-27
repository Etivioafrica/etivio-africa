import { formatDuration, formatPrice } from "@/lib/format";
import type { CourseCard, MyCourse } from "@/lib/data/learn";
import type { Tile } from "@/components/dash/CourseTiles";

export function progressOf(c: MyCourse) {
  if (c.expired) return { value: c.progress, left: "Access ended" };
  if (c.completed) return { value: 100, left: "Finished" };
  const left = c.secondsLeft ? `${formatDuration(c.secondsLeft)} left` : `${c.lessonsLeft} ${c.lessonsLeft === 1 ? "lesson" : "lessons"} left`;
  return { value: c.progress, left };
}

export function catalogTile(c: CourseCard & { reason?: string | null }, mine: Map<string, MyCourse>, savedIds: Set<string>, forYou: Set<string>): Tile {
  const enrolled = mine.get(c.id);
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    coverUrl: c.coverUrl,
    href: enrolled ? `/learn/course/${c.id}` : `/learn/browse/${c.id}`,
    tags: [c.level, ...(forYou.has(c.id) ? ["for-you"] : [])],
    tagline: c.reason ?? c.category,
    forYou: !!c.reason,
    progress: enrolled ? progressOf(enrolled) : null,
    meta: enrolled ? null : { by: c.instructor, lessons: c.lessonCount, rating: c.rating, reviews: c.reviews, price: formatPrice(c.priceMinor, c.currency) },
    saved: enrolled ? undefined : savedIds.has(c.id),
  };
}
