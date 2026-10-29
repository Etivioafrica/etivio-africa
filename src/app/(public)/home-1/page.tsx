import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, AtSign, Award, BadgeCheck, BookOpen, Bookmark, Check, Flame, LifeBuoy, Megaphone, PlayCircle, Sparkles, StickyNote, Upload, Users, Wallet } from "lucide-react";
import { Cover } from "@/components/dash/ui";
import { AiAvatar } from "@/components/learn/AiAvatar";
import { HeroStage } from "../HeroStage";
import { createClient } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/data/learn";
import { formatPrice } from "@/lib/format";

export const metadata = {
  title: "Etivio | Learn the skills that move you forward",
  description: "Practical courses from instructors across Africa. Learn at your pace, track your progress, and earn certificates you can share.",
  // The previous home page, kept for reference now that Home 2 is at /; out of search so it doesn't compete with it.
  robots: { index: false, follow: false },
};

const STEPS = [
  { icon: BookOpen, title: "Pick a course", body: "Practical courses taught by people who do the work, across Africa." },
  { icon: PlayCircle, title: "Learn at your pace", body: "Short lessons, notes, and bookmarks. Pick up exactly where you stopped." },
  { icon: Award, title: "Earn your certificate", body: "Finish a course and get a verified certificate you can add to LinkedIn." },
];

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

// Home 1, the previous landing page, laid out after huly.io: dark hero with a light beam, then alternating light and dark sections.
export default function Home() {
  return (
    <>
      <section className="et-lp-hero">
        <div className="et-lp-copy">
          <span className="et-lp-pill">Learn, teach and earn in one platform</span>
          <h1>
            Learn Better Skills.
            <br />
            Track Real Progress.
          </h1>
          <p>Practical courses from instructors across Africa. Learn at your own pace, track every lesson, and earn certificates you can share.</p>
          <Suspense fallback={<HeroCtas signedIn={false} />}>
            <SessionCtas />
          </Suspense>
        </div>
        <HeroStage />
      </section>

      {/* More than videos: bento of dark cards, each with a small piece of the product */}
      <section className="et-lp-sec">
        <div className="et-lp-wrap">
          <div className="et-lp-head">
            <h2>More than videos</h2>
            <p>Etivio keeps you moving between lessons, with weekly goals, rewards, and proof of everything you have learned.</p>
          </div>
          <div className="et-lp-bento">
            <article className="et-lp-card is-sm">
              <div className="et-lp-art">
                <div className="et-lp-cert">
                  <span className="et-lp-cert-seal">
                    <BadgeCheck size={18} />
                  </span>
                  <small>Certificate of completion</small>
                  <b>Web Development for Beginners</b>
                  <i />
                  <span className="et-lp-cert-id">
                    <Check size={11} /> Verified · ETV-7Q2K-91XD
                  </span>
                </div>
              </div>
              <p>
                <b>Verified certificates.</b> Every certificate has an ID anyone can check.
              </p>
            </article>

            <article className="et-lp-card is-lg">
              <div className="et-lp-art">
                <div className="et-lp-goal">
                  <div className="et-lp-ring" style={{ ["--p" as string]: "80%" }}>
                    <span>
                      <b>4/5</b>
                      <small>lessons</small>
                    </span>
                  </div>
                  <div className="et-lp-goal-side">
                    <span className="et-lp-streak">
                      <Flame size={15} /> 12 day streak
                    </span>
                    <div className="et-lp-week">
                      {WEEK.map((d, i) => (
                        <span key={i} className={i < 5 ? "is-on" : ""}>
                          <i />
                          {d}
                        </span>
                      ))}
                    </div>
                    <small>Weekly goal: 5 lessons</small>
                  </div>
                </div>
              </div>
              <p>
                <b>Streaks and goals.</b> Set a weekly goal, keep your streak alive, and build a learning habit that sticks.
              </p>
            </article>

            <article className="et-lp-card is-lg">
              <div className="et-lp-art">
                <div className="et-lp-notes">
                  <div className="et-lp-note is-back">
                    <span>
                      <Bookmark size={12} /> 07:41
                    </span>
                    Flexbox: justify-content vs align-items
                  </div>
                  <div className="et-lp-note">
                    <span>
                      <StickyNote size={12} /> 03:24 · HTML for beginners
                    </span>
                    Every page needs a doctype, a head for the details, and a body for what people see.
                  </div>
                </div>
              </div>
              <p>
                <b>Notes and bookmarks.</b> Save the moments that matter and pick up exactly where you stopped.
              </p>
            </article>

            <article className="et-lp-card is-sm">
              <div className="et-lp-art">
                <div className="et-lp-badge">
                  <Award size={34} />
                  <span>3</span>
                </div>
              </div>
              <p>
                <b>Badges.</b> Unlock badges as you learn and show them off.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* How it works: big centred statement over a glass panel */}
      <section className="et-lp-sec et-lp-how">
        <div className="et-lp-wrap">
          <div className="et-lp-head is-center">
            <h2>
              Pick it. Learn it.
              <br />
              Prove it.
            </h2>
            <p>From your first lesson to a certificate you can share, in three simple steps.</p>
          </div>
          <div className="et-lp-steps">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="et-lp-step">
                <span className="et-lp-step-n">0{i + 1}</span>
                <span className="et-lp-step-icon">
                  <Icon size={20} />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <Featured />
      </Suspense>

      {/* Etivio AI and the tools around it: mosaic of dark cards around the AI star */}
      <section className="et-lp-sec">
        <div className="et-lp-wrap">
          <div className="et-lp-head">
            <h2>Your study buddy, built in</h2>
            <p>Ask Etivio AI about any lesson, get unstuck fast, and keep everything you need for learning in one place.</p>
          </div>
          <div className="et-lp-mosaic">
            <article className="et-lp-tile is-ask">
              <p>
                <b>Ask anything.</b> Get answers about the lesson you are on.
              </p>
              <div className="et-lp-chat">
                <span className="is-me">What does the viewport meta tag do?</span>
                <span>It tells phones to fit the page to the screen width, so your layout does not shrink.</span>
              </div>
            </article>
            <article className="et-lp-tile">
              <p>
                <b>Stay in the loop.</b> Course news and announcements from your tutors.
              </p>
              <div className="et-lp-mini-list">
                <span>
                  <Megaphone size={13} /> New lesson: CSS Grid in 10 minutes
                </span>
                <span>
                  <Megaphone size={13} /> Live Q&amp;A this Friday
                </span>
              </div>
            </article>
            <div className="et-lp-orb">
              <AiAvatar size={132} inverse />
              <b>Etivio AI</b>
            </div>
            <article className="et-lp-tile">
              <p>
                <b>Get support.</b> Message our team from your dashboard any time.
              </p>
              <div className="et-lp-chat is-small">
                <span>
                  <LifeBuoy size={12} /> Hi! How can we help today?
                </span>
              </div>
            </article>
            <article className="et-lp-tile">
              <p>
                <b>Save for later.</b> Keep the courses and resources you want in one list.
              </p>
              <div className="et-lp-mini-list">
                <span>
                  <Bookmark size={13} /> UI Design Starter Kit
                </span>
                <span>
                  <Bookmark size={13} /> Excel for Small Business
                </span>
              </div>
            </article>
            <article className="et-lp-tile is-wide">
              <p>
                <b>Learn anywhere.</b> Install Etivio on your phone and keep going on the bus, at lunch, or at home.
              </p>
              <div className="et-lp-progress">
                <span>Web Development for Beginners</span>
                <i>
                  <b style={{ width: "64%" }} />
                </i>
                <small>64% complete · 11 lessons left</small>
              </div>
            </article>
            <article className="et-lp-tile">
              <p>
                <b>Share your profile.</b> Show your skills and progress at your own link.
              </p>
              <div className="et-lp-handle">
                <AtSign size={14} /> etivio.co/@you
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Teach on Etivio: floating card on the left, text on the right */}
      <section className="et-lp-sec et-lp-teach">
        <div className="et-lp-wrap">
          <div className="et-lp-teach-art" aria-hidden="true">
            <div className="et-lp-earn">
              <small>
                <Wallet size={13} /> Tutor earnings
              </small>
              <b>₦486,000</b>
              <div className="et-lp-bars">
                {[38, 52, 44, 70, 62, 88, 76].map((h, i) => (
                  <i key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="et-lp-float">
              <span>
                <Users size={14} />
              </span>
              <div>
                <b>214 students</b>
                <small>enrolled this month</small>
              </div>
            </div>
            <div className="et-lp-float is-2">
              <span>
                <Upload size={14} />
              </span>
              <div>
                <b>Lesson uploaded</b>
                <small>Module 3 · 12 min video</small>
              </div>
            </div>
          </div>
          <div className="et-lp-teach-copy">
            <h2>
              Teach what
              <br />
              you know
            </h2>
            <p>Turn your skills into a course. Upload lessons, follow your students&apos; progress, and earn when they enrol.</p>
            <p>
              <b>Tutors on Etivio</b> build courses with video, notes and files, sell templates and e-books in the marketplace, and get paid straight to their bank account.
            </p>
            <Link href="/teach-on-etivio" className="et-lp-link">
              Apply to teach <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Closing call to action, dark */}
      <section className="et-lp-final">
        <div className="et-lp-wrap">
          <div className="et-lp-dial" aria-hidden="true">
            <span className="et-lp-dial-ring" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/etivio-mark.svg" alt="" />
          </div>
          <div className="et-lp-final-copy">
            <h2>
              Start learning
              <br />
              today
            </h2>
            <p>Create your free account in under a minute. Your first lesson is waiting.</p>
            <div className="et-lp-final-ctas">
              <Suspense fallback={<HeroCtas signedIn={false} />}>
                <SessionCtas />
              </Suspense>
              <Link href="/explore" className="et-lp-ghost">
                <Sparkles size={14} /> Browse courses
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function HeroCtas({ signedIn }: { signedIn: boolean }) {
  return (
    <Link href={signedIn ? "/learn" : "/signup"} className="et-lp-cta">
      {signedIn ? "Go to dashboard" : "Get Started Free"}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

async function SessionCtas() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <HeroCtas signedIn={Boolean(user)} />;
}

// A few published courses on a dark, glowing stage. Hidden until there are some.
async function Featured() {
  // Courses starred in Admin › Courses come first.
  const courses = (await getCatalog(12)).sort((a, b) => Number(!!b.featured) - Number(!!a.featured)).slice(0, 3);
  if (!courses.length) return null;
  return (
    <section className="et-lp-dark">
      <div className="et-lp-wrap">
        <div className="et-lp-head">
          <h2>
            Courses worth
            <br />
            your time
          </h2>
          <p>Practical courses taught by people who do the work. Start with one of these.</p>
        </div>
        <div className="et-lp-glow">
          <div className="et-course-grid">
            {courses.map((c) => (
              <Link key={c.id} href={`/courses/${c.slug}`} className="et-card et-course">
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
              </Link>
            ))}
          </div>
          <Link href="/explore" className="et-lp-link is-light">
            Explore the marketplace <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
