import Link from "next/link";
import { Award, BarChart3, BookOpen, CalendarDays, Check, ChevronRight, Clock, FileText, Heart, Infinity as Lifetime, ListChecks, Paperclip, PlayCircle, Star, Users } from "lucide-react";
import { Cover } from "@/components/dash/ui";
import { Avatar } from "@/components/dash/Avatar";
import { ShareButton } from "@/components/dash/ShareButton";
import { Suspense } from "react";
import { enrollFree, toggleSaved } from "@/app/(app)/learn/actions";
import { startCheckout } from "@/app/checkout/actions";
import { PaymentNotice } from "./PaymentNotice";
import type { getCourseDetails } from "@/lib/data/learn";
import { formatDate, formatDuration, formatPrice } from "@/lib/format";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
const monthYear = (d: string) => new Date(d).toLocaleDateString("en-GB", { month: "numeric", year: "numeric" });
const NEW_FOR_DAYS = 30;
const isRecent = (d: string | null) => !!d && Date.now() - Date.parse(d) < NEW_FOR_DAYS * 86_400_000;

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="et-ud-stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export type CourseData = NonNullable<Awaited<ReturnType<typeof getCourseDetails>>>;

// The course details page (Udemy-style), shared by the in-app page and the public /courses/[slug] page.
// Call connection() before rendering: the "New" badge depends on today's date.
export function CourseView({ data }: { data: CourseData }) {
  const { course, instructor, modules, stats, reviews, enrolled, saved, signedIn } = data;
  const publicPath = `/courses/${course.slug}`;
  const free = course.priceMinor === 0;
  const hasPreview = modules.some((m) => m.lessons.some((l) => l.preview));

  const badges = [
    course.featured && { label: "Featured", tone: "blue" },
    stats.rating !== null && stats.rating >= 4.5 && stats.reviews >= 3 && { label: "Highest rated", tone: "amber" },
    isRecent(course.publishedAt) && { label: "New", tone: "green" },
  ].filter(Boolean) as { label: string; tone: string }[];

  const cta = !signedIn ? (
    <Link href={`/signup?next=${encodeURIComponent(publicPath)}`} className="et-btn et-btn-primary et-ud-cta">
      {free ? "Sign up to enroll for free" : "Sign up to enroll"}
    </Link>
  ) : enrolled ? (
    <Link href={`/learn/course/${course.id}`} className="et-btn et-btn-primary et-ud-cta">
      Go to course
    </Link>
  ) : free ? (
    <form action={enrollFree}>
      <input type="hidden" name="courseId" value={course.id} />
      <button type="submit" className="et-btn et-btn-primary et-ud-cta">
        Enroll for free
      </button>
    </form>
  ) : (
    <form action={startCheckout}>
      <input type="hidden" name="type" value="course" />
      <input type="hidden" name="slug" value={course.slug} />
      <button type="submit" className="et-btn et-btn-primary et-ud-cta">
        Buy now
      </button>
    </form>
  );

  return (
    <div className="et-ud">
      <Suspense fallback={null}>
        <PaymentNotice />
      </Suspense>
      <section className="et-ud-hero">
        <div className="et-ud-grid">
          <div className="et-ud-hero-text">
            <nav className="et-ud-crumb" aria-label="Breadcrumb">
              <Link href="/explore">Explore</Link>
              <ChevronRight size={14} />
              <Link href="/explore?type=course">Courses</Link>
              {course.category && (
                <>
                  <ChevronRight size={14} />
                  <Link href={`/explore?type=course&q=${encodeURIComponent(course.category)}`}>{course.category}</Link>
                </>
              )}
            </nav>
            <h1>{course.title}</h1>
            {course.summary && <p className="et-ud-sub">{course.summary}</p>}
            {badges.length > 0 && (
              <div className="et-ud-badges">
                {badges.map((b) => (
                  <span key={b.label} className={`et-ud-badge is-${b.tone}`}>
                    {b.label}
                  </span>
                ))}
              </div>
            )}
            <p className="et-ud-by">
              Created by <a href="#instructor">{instructor.name}</a>
            </p>
            <p className="et-ud-meta">
              <span>
                <CalendarDays size={15} /> Last updated {monthYear(course.updatedAt)}
              </span>
              <span>
                <BarChart3 size={15} /> <span className="et-cap">{course.level}</span>
              </span>
              <span>
                <Award size={15} /> Certificate of completion
              </span>
            </p>
          </div>

          <div className="et-ud-side-slot">
            <aside className="et-ud-card">
              <div className="et-ud-preview">
                <Cover url={course.coverUrl} />
                {hasPreview && (
                  <a href="#content" className="et-ud-play">
                    <span>
                      <PlayCircle size={34} strokeWidth={1.6} />
                    </span>
                    <b>Preview this course</b>
                  </a>
                )}
              </div>
              <div className="et-ud-card-body">
                <p className="et-ud-price">{free ? "Free" : formatPrice(course.priceMinor, course.currency)}</p>
                {cta}
                {signedIn && !enrolled && (
                  <form action={toggleSaved}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="saved" value={saved ? "1" : "0"} />
                    <button type="submit" className={`et-btn et-ud-cta et-ud-outline${saved ? " is-saved" : ""}`} aria-pressed={saved}>
                      <Heart size={16} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved for later" : "Save for later"}
                    </button>
                  </form>
                )}
                <ul className="et-ud-perks">
                  <li>
                    <Lifetime size={16} /> Full lifetime access
                  </li>
                  <li>
                    <Award size={16} /> Certificate of completion
                  </li>
                  <li>
                    <BookOpen size={16} /> {plural(stats.lessons, "lesson")}
                    {stats.seconds ? ` · ${formatDuration(stats.seconds)}` : ""}
                  </li>
                  {stats.files > 0 && (
                    <li>
                      <Paperclip size={16} /> {plural(stats.files, "downloadable resource")}
                    </li>
                  )}
                  {stats.quizzes > 0 && (
                    <li>
                      <ListChecks size={16} /> {stats.quizzes} {stats.quizzes === 1 ? "quiz" : "quizzes"}
                    </li>
                  )}
                </ul>
              </div>
              <div className="et-ud-card-foot">
                <ShareButton title={course.title} path={publicPath} className="et-ud-share" />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <div className="et-ud-grid et-ud-body">
        <div className="et-ud-main">
          <div className="et-ud-stats">
            <div>
              {stats.rating !== null ? (
                <>
                  <b>{stats.rating.toFixed(1)}</b>
                  <Stars value={stats.rating} />
                  <a href="#reviews">{plural(stats.reviews, "rating")}</a>
                </>
              ) : (
                <>
                  <b>New</b>
                  <Stars value={0} />
                  <small>No ratings yet</small>
                </>
              )}
            </div>
            <div>
              <Users size={20} />
              <b>{stats.students.toLocaleString()}</b>
              <small>{stats.students === 1 ? "learner" : "learners"}</small>
            </div>
            <div>
              <BookOpen size={20} />
              <b>{stats.lessons}</b>
              <small>{stats.lessons === 1 ? "lesson" : "lessons"}</small>
            </div>
            <div>
              <Clock size={20} />
              <b>{stats.seconds ? formatDuration(stats.seconds) : "Self-paced"}</b>
              <small>{stats.seconds ? "of content" : "learn anytime"}</small>
            </div>
          </div>

          {course.skills.length > 0 && (
            <section className="et-ud-box">
              <h2>What you&apos;ll learn</h2>
              <ul className="et-ud-learn">
                {course.skills.map((s) => (
                  <li key={s}>
                    <Check size={16} /> {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="et-ud-section" id="content">
            <div className="et-ud-section-head">
              <h2>Course content</h2>
              <small>
                {plural(modules.length, "section")} · {plural(stats.lessons, "lesson")}
                {stats.seconds ? ` · ${formatDuration(stats.seconds)} total length` : ""}
              </small>
            </div>
            <div className="et-cd-modules">
              {modules.map((m, i) => (
                <details key={m.id} open={i === 0}>
                  <summary>
                    <ChevronRight size={16} className="et-ud-chev" />
                    <b>{m.title}</b>
                    <small>
                      {plural(m.lessons.length, "lesson")}
                      {m.quiz ? " · quiz" : ""}
                    </small>
                  </summary>
                  <ul>
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        {l.kind === "reading" ? <FileText size={15} /> : <PlayCircle size={15} />}
                        <span>{l.title}</span>
                        {l.preview && <em className="et-tag">Preview</em>}
                        {l.seconds ? <small>{formatDuration(l.seconds)}</small> : null}
                      </li>
                    ))}
                    {m.quiz && (
                      <li>
                        <ListChecks size={15} />
                        <span>{m.quiz}</span>
                        <small>Quiz</small>
                      </li>
                    )}
                    {!m.lessons.length && !m.quiz && <li className="et-muted">Lessons coming soon.</li>}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          {course.description && (
            <section className="et-ud-section">
              <h2>Description</h2>
              <p className="et-cd-about">{course.description}</p>
            </section>
          )}

          <section className="et-ud-section" id="instructor">
            <h2>Instructor</h2>
            <div className="et-cd-instructor">
              <Avatar src={instructor.avatar} initial={instructor.name.charAt(0).toUpperCase()} className="et-cd-avatar" />
              <div>
                <b className="et-ud-inst-name">{instructor.name}</b>
                {instructor.headline && <small>{instructor.headline}</small>}
              </div>
            </div>
            {instructor.bio && <p className="et-cd-about">{instructor.bio}</p>}
          </section>

          {reviews.length > 0 && (
            <section className="et-ud-section" id="reviews">
              <h2 className="et-ud-rating-head">
                <Star size={20} fill="currentColor" /> {stats.rating?.toFixed(1)} course rating · {plural(stats.reviews, "rating")}
              </h2>
              <div className="et-cd-reviews">
                {reviews.map((r) => (
                  <article key={r.id}>
                    <div className="et-cd-review-head">
                      <Avatar src={r.avatar} initial={r.author.charAt(0).toUpperCase()} className="et-cd-avatar is-sm" />
                      <div>
                        <b>{r.author}</b>
                        <span className="et-cd-stars">
                          <Stars value={r.rating} size={12} />
                          <small>{formatDate(r.at)}</small>
                        </span>
                      </div>
                    </div>
                    {r.body && <p>{r.body}</p>}
                    {r.reply && (
                      <p className="et-cd-reply">
                        <b>Reply from Etivio:</b> {r.reply}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
