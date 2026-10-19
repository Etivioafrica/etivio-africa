import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BarChart3, BookOpen, Check, Clock, FileText, Heart, ListChecks, Paperclip, PlayCircle, Star, Users } from "lucide-react";
import { Cover } from "@/components/dash/ui";
import { enrollFree, toggleSaved } from "../../actions";
import { getCourseDetails } from "@/lib/data/learn";
import { formatDate, formatDuration, formatPrice } from "@/lib/format";

export const metadata = { title: "Course details" };

type Props = { params: Promise<{ id: string }> };

export default function CourseDetails({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Details params={params} />
      </Suspense>
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function Details({ params }: Props) {
  const { id } = await params;
  const data = await getCourseDetails(id);
  if (!data) notFound();
  const { course, instructor, modules, stats, reviews, enrolled, saved } = data;
  const free = course.priceMinor === 0;

  const cta = enrolled ? (
    <Link href={`/learn/course/${course.id}`} className="et-btn et-btn-primary et-cd-cta">
      Go to course
    </Link>
  ) : free ? (
    <form action={enrollFree}>
      <input type="hidden" name="courseId" value={course.id} />
      <button type="submit" className="et-btn et-btn-primary et-cd-cta">
        Enroll for free
      </button>
    </form>
  ) : (
    <button className="et-btn et-btn-primary et-cd-cta" disabled data-tip="Paid checkout is coming soon">
      Enroll · {formatPrice(course.priceMinor, course.currency)}
    </button>
  );

  return (
    <>
      <p className="et-set-crumb">
        <Link href="/learn/browse">Browse courses</Link> <span>/</span> {course.title}
      </p>

      <div className="et-cd">
        <div className="et-cd-main">
          <header className="et-cd-head">
            {course.category && <p className="et-course-tagline">{course.category}</p>}
            <h1>{course.title}</h1>
            {course.summary && <p className="et-cd-summary">{course.summary}</p>}
            <div className="et-cd-facts">
              {stats.rating !== null && (
                <span className="et-cd-rating">
                  <Star size={14} fill="currentColor" /> {stats.rating.toFixed(1)} <small>({plural(stats.reviews, "review")})</small>
                </span>
              )}
              <span>
                <Users size={14} /> {plural(stats.students, "learner")}
              </span>
              <span>
                <BarChart3 size={14} /> <span className="et-cap">{course.level}</span>
              </span>
              <span>Updated {formatDate(course.updatedAt)}</span>
            </div>
            <p className="et-cd-by">
              By <b>{instructor.name}</b>
            </p>
          </header>

          {course.skills.length > 0 && (
            <section className="et-card et-cd-section">
              <h2>What you&apos;ll learn</h2>
              <ul className="et-cd-skills">
                {course.skills.map((s) => (
                  <li key={s}>
                    <Check size={15} /> {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {course.description && (
            <section className="et-card et-cd-section">
              <h2>About this course</h2>
              <p className="et-cd-about">{course.description}</p>
            </section>
          )}

          <section className="et-card et-cd-section">
            <div className="et-cd-section-head">
              <h2>Course content</h2>
              <small>
                {plural(modules.length, "module")} · {plural(stats.lessons, "lesson")}
                {stats.seconds ? ` · ${formatDuration(stats.seconds)} total` : ""}
              </small>
            </div>
            <div className="et-cd-modules">
              {modules.map((m, i) => (
                <details key={m.id} open={i === 0}>
                  <summary>
                    <span className="et-wiz-num">{i + 1}</span>
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

          <section className="et-card et-cd-section">
            <h2>Your instructor</h2>
            <div className="et-cd-instructor">
              <span className="et-cd-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {instructor.avatar ? <img src={instructor.avatar} alt="" /> : instructor.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <b>{instructor.name}</b>
                {instructor.headline && <small>{instructor.headline}</small>}
              </div>
            </div>
            {instructor.bio && <p className="et-cd-about">{instructor.bio}</p>}
          </section>

          {reviews.length > 0 && (
            <section className="et-card et-cd-section">
              <h2>What learners say</h2>
              <div className="et-cd-reviews">
                {reviews.map((r) => (
                  <article key={r.id}>
                    <div className="et-cd-review-head">
                      <span className="et-cd-avatar is-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.avatar ? <img src={r.avatar} alt="" /> : r.author.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <b>{r.author}</b>
                        <span className="et-cd-stars" aria-label={`${r.rating} out of 5`}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} size={12} fill={n <= r.rating ? "currentColor" : "none"} />
                          ))}
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

        <aside className="et-card et-cd-side">
          <div className="et-cd-media">
            <Cover url={course.coverUrl} />
          </div>
          <div className="et-cd-side-body">
            <p className="et-cd-price">{free ? "Free" : formatPrice(course.priceMinor, course.currency)}</p>
            {cta}
            {!enrolled && (
              <form action={toggleSaved}>
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="saved" value={saved ? "1" : "0"} />
                <button type="submit" className={`et-btn et-btn-ghost et-cd-cta${saved ? " is-saved" : ""}`} aria-pressed={saved}>
                  <Heart size={15} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save for later"}
                </button>
              </form>
            )}
            <h3>This course includes</h3>
            <ul className="et-cd-includes">
              <li>
                <BookOpen size={15} /> {plural(stats.lessons, "lesson")}
              </li>
              {stats.videos > 0 && (
                <li>
                  <PlayCircle size={15} /> {plural(stats.videos, "video lesson")}
                </li>
              )}
              {stats.readings > 0 && (
                <li>
                  <FileText size={15} /> {plural(stats.readings, "reading")}
                </li>
              )}
              {stats.seconds > 0 && (
                <li>
                  <Clock size={15} /> {formatDuration(stats.seconds)} of content
                </li>
              )}
              {stats.files > 0 && (
                <li>
                  <Paperclip size={15} /> {plural(stats.files, "downloadable file")}
                </li>
              )}
              {stats.quizzes > 0 && (
                <li>
                  <ListChecks size={15} /> {stats.quizzes} {stats.quizzes === 1 ? "quiz" : "quizzes"}
                </li>
              )}
              <li>
                <Award size={15} /> Certificate when you finish
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
