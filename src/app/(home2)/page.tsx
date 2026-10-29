import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  AtSign,
  Award,
  BookOpen,
  CalendarClock,
  Check,
  Heart,
  ImageIcon,
  MessageCircle,
  PlayCircle,
  Plus,
  Sparkles,
  Star,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { getCatalog } from "@/lib/data/learn";
import { listCoaches } from "@/lib/data/coaching";
import { featureOnForVisitor } from "@/lib/data/features";
import { formatPrice } from "@/lib/format";
import { Caveat } from "next/font/google";
import { HeroCta } from "./HeroCta";
import { HeroReel } from "./HeroReel";
import { Home2Nav } from "./Home2Nav";
import { AppDemo } from "./AppDemo";
import "./home2.css";

export const metadata: Metadata = {
  title: "Etivio | Learn, connect and build",
  description:
    "Courses, communities, coaches and an AI study partner, built for learners across Africa.",
};

const PILLARS = [
  {
    icon: BookOpen,
    tone: "is-blue",
    title: "Learn",
    body: "Short, practical lessons with notes, bookmarks, quizzes and a certificate at the end.",
  },
  {
    icon: Users,
    tone: "is-green",
    title: "Connect",
    body: "Join communities around what you are learning and post on Campus with learners like you.",
  },
  {
    icon: Video,
    tone: "is-amber",
    title: "Get coached",
    body: "Book a 1-on-1 video session with a coach when you want feedback or a push.",
  },
  {
    icon: Wallet,
    tone: "is-ink",
    title: "Teach and earn",
    body: "Turn what you know into courses, templates and e-books, and get paid in your currency.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Tell us your goals",
    body: "Pick what you want to learn. Etivio suggests courses and communities to start with.",
  },
  {
    n: "02",
    title: "Learn a little every day",
    body: "Set a weekly goal, keep your streak, and ask Etivio AI whenever you get stuck.",
  },
  {
    n: "03",
    title: "Show what you can do",
    body: "Finish a course, earn a verified certificate, and share it with anyone.",
  },
];

const FAQ = [
  {
    q: "Is Etivio free to join?",
    a: "Yes. Creating an account, joining communities and posting on Campus are free. Some courses are free and others are paid; the price is always shown before you enrol.",
  },
  {
    q: "Do I get a certificate?",
    a: "When you finish a course you get a certificate with its own ID. Anyone can check it on the Verify a certificate page, and you can add it to LinkedIn.",
  },
  {
    q: "How long do I keep access to a course?",
    a: "Each course shows its access period on its page. Many give lifetime access, and some give access for a set number of months.",
  },
  {
    q: "What is Campus?",
    a: "Campus is the Etivio feed. Share wins, ask questions, post photos and videos, and mention other learners.",
  },
  {
    q: "Can I teach on Etivio?",
    a: "Yes. Apply to teach, build your course with our tools, set a price and get paid out to your bank account.",
  },
  {
    q: "How do I pay?",
    a: "You can pay by card, bank transfer or USSD. Prices show in your local currency where we support it.",
  },
];

const hand = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--h2-hand",
});

export default function Home2() {
  return (
    <div className={`et-h2 ${hand.variable}`}>
      <Home2Nav />

      <main>
        {/* 2. Hero: centred copy over a curved reel of product scenes */}
        <section className="et-h2-hero">
          <div className="et-h2-hero-copy">
            <span className="et-h2-pill">Built for learners across Africa</span>
            <h1>
              <svg
                className="et-h2-tick"
                viewBox="0 0 40 30"
                aria-hidden="true"
              >
                <path d="M6 26 L14 12 M16 28 L26 6" />
              </svg>
              <span>Learn, connect</span> <span>and build your career.</span>
            </h1>
            <p>
              Practical <b>courses</b>, <b>communities</b> that keep you going,{" "}
              <b>coaches</b> when you need them, and an <b>AI study partner</b>{" "}
              that knows your lessons.
            </p>
            <span className="et-h2-note is-right" aria-hidden="true">
              <span>
                learn at
                <br />
                your pace
              </span>
              <svg viewBox="0 0 90 70">
                <path d="M4 10 C 50 6, 84 24, 72 62" />
                <path d="M62 54 L72 63 L80 51" />
              </svg>
            </span>
          </div>

          <HeroReel />

          <div className="et-h2-hero-go">
            <span className="et-h2-note is-left" aria-hidden="true">
              <svg viewBox="0 0 60 40">
                <path d="M6 30 C 18 8, 36 6, 52 18" />
                <path d="M42 12 L53 19 L44 28" />
              </svg>
              <span>free to join</span>
            </span>
            <HeroCta />
          </div>
        </section>

        {/* 3. Product tour: the app playing itself on a coloured panel */}
        <section className="et-h2-demo-sec" aria-label="Product tour">
          <AppDemo />
        </section>

        {/* 4. Four pillars */}
        <section className="et-h2-sec is-flush" id="features">
          <div className="et-h2-box">
            <div className="et-h2-head">
              <span className="et-h2-kicker">One platform</span>
              <h2>Everything you need to grow, not just videos.</h2>
              <p>
                Etivio brings learning, people and earning together, so you
                never have to piece it together from five apps.
              </p>
            </div>
            <div className="et-h2-pillars">
              {PILLARS.map(({ icon: Icon, tone, title, body }) => (
                <article key={title} className={`et-h2-pillar ${tone}`}>
                  <span className="et-h2-pillar-icon">
                    <Icon size={22} />
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. How it works */}
        <section className="et-h2-sec is-tint">
          <div className="et-h2-split">
            <div className="et-h2-head">
              <span className="et-h2-kicker">How it works</span>
              <h2>From first lesson to proof of skill.</h2>
              <p>
                Three steps, at your own pace, on your phone or your laptop.
              </p>
              <Link href="/signup" className="et-h2-btn is-ink">
                Create your account <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <ol className="et-h2-steps">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="et-h2-step-n">{s.n}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 6. Featured courses */}
        <Suspense fallback={null}>
          <Courses />
        </Suspense>

        {/* 7. Communities */}
        <section className="et-h2-band is-ink" id="communities">
          <div className="et-h2-split">
            <div className="et-h2-head">
              <span className="et-h2-kicker">Communities</span>
              <h2>Learn with people who get it.</h2>
              <p>
                Join a community for your course, your career or your city.
                Share progress, swap resources and find people to study with.
              </p>
              <ul className="et-h2-ticks">
                <li>
                  <Check size={16} /> Public and private communities
                </li>
                <li>
                  <Check size={16} /> Posts, events and group chats
                </li>
                <li>
                  <Check size={16} /> Start your own in a minute
                </li>
              </ul>
              <Link href="/signup" className="et-h2-btn is-white">
                Find your community <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="et-h2-comms" aria-hidden="true">
              {[
                {
                  name: "Lagos Product Designers",
                  members: "1.2k members",
                  tone: "is-blue",
                  tag: "Design",
                },
                {
                  name: "Frontend Africa",
                  members: "860 members",
                  tone: "is-green",
                  tag: "Code",
                },
                {
                  name: "Creators Who Sell",
                  members: "540 members",
                  tone: "is-amber",
                  tag: "Business",
                },
              ].map((c) => (
                <div key={c.name} className="et-h2-comm">
                  <span className={`et-h2-comm-icon ${c.tone}`}>
                    {c.name.charAt(0)}
                  </span>
                  <div>
                    <b>{c.name}</b>
                    <small>
                      {c.members} · {c.tag}
                    </small>
                  </div>
                  <span className="et-h2-comm-join">
                    <Plus size={14} /> Join
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. Campus */}
        <section className="et-h2-sec" id="campus">
          <div className="et-h2-split is-flip">
            <div className="et-h2-head">
              <span className="et-h2-kicker">Campus</span>
              <h2>Your learning feed, with real people in it.</h2>
              <p>
                Post your wins, ask questions and share what you are building.
                Add photos and video links, mention classmates and get replies
                as they happen.
              </p>
              <div className="et-h2-feats">
                <span>
                  <AtSign size={16} /> Mentions
                </span>
                <span>
                  <ImageIcon size={16} /> Photo editor
                </span>
                <span>
                  <PlayCircle size={16} /> Video links
                </span>
                <span>
                  <MessageCircle size={16} /> Replies
                </span>
              </div>
            </div>
            <div className="et-h2-post" aria-hidden="true">
              <div className="et-h2-post-head">
                <span className="et-h2-av is-green">A</span>
                <div>
                  <b>Amaka O.</b>
                  <small>Product design · 2h</small>
                </div>
              </div>
              <p>
                Just finished my first case study for the UI Foundations course.
                Thank you <em>@tunde</em> for the feedback on the onboarding
                flow!
              </p>
              <div className="et-h2-post-img">
                <div className="et-h2-post-frame">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="et-h2-post-foot">
                <span>
                  <Heart size={15} /> 48
                </span>
                <span>
                  <MessageCircle size={15} /> 12 replies
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 9. Etivio AI */}
        <section className="et-h2-band is-blue">
          <div className="et-h2-split">
            <div className="et-h2-head">
              <span className="et-h2-kicker">Etivio AI</span>
              <h2>A study partner that knows your lessons.</h2>
              <p>
                Stuck on a lesson at midnight? Ask Etivio AI. It explains ideas
                in plain words, quizzes you, and points you to the exact lesson
                to rewatch.
              </p>
              <Link href="/signup" className="et-h2-btn is-white">
                Try Etivio AI <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="et-h2-chat" aria-hidden="true">
              <div className="et-h2-bubble is-me">
                What is the difference between margin and padding?
              </div>
              <div className="et-h2-bubble is-ai">
                <span className="et-h2-ai-mark">
                  <Sparkles size={13} />
                </span>
                <p>
                  Padding is the space inside a box, between its border and its
                  content. Margin is the space outside, between the box and its
                  neighbours. Lesson 3 at 04:12 shows both.
                </p>
              </div>
              <div className="et-h2-bubble is-me">Quiz me on it</div>
              <div className="et-h2-typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </section>

        {/* 10. Coaches */}
        <Suspense fallback={null}>
          <Coaches />
        </Suspense>

        {/* 11. Teach on Etivio */}
        <section className="et-h2-band is-amber">
          <div className="et-h2-split is-flip">
            <div className="et-h2-head">
              <span className="et-h2-kicker">Teach on Etivio</span>
              <h2>Know something worth teaching? Get paid for it.</h2>
              <p>
                Build courses with lessons, quizzes and certificates. Sell
                templates and e-books. See every sale, every learner and every
                payout in one dashboard.
              </p>
              <div className="et-h2-hero-ctas">
                <Link href="/teach-on-etivio" className="et-h2-btn is-ink">
                  Start teaching <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="et-h2-earn" aria-hidden="true">
              <div className="et-h2-earn-top">
                <small>This month</small>
                <span className="et-h2-chip is-green">
                  <ArrowUpRight size={13} /> 24%
                </span>
              </div>
              <b className="et-h2-earn-total">₦ 1,284,500</b>
              <div className="et-h2-bars">
                {[38, 52, 44, 66, 58, 80, 72, 94].map((h, i) => (
                  <i key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="et-h2-earn-rows">
                <span>
                  <BookOpen size={14} /> Course sales <b>₦ 912,000</b>
                </span>
                <span>
                  <Award size={14} /> Templates <b>₦ 372,500</b>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 12. FAQ */}
        <section className="et-h2-sec">
          <div className="et-h2-split is-top">
            <div className="et-h2-head">
              <span className="et-h2-kicker">Questions</span>
              <h2>Good to know before you start.</h2>
              <p>
                Still unsure? <Link href="/help">Visit the help centre</Link> or{" "}
                <Link href="/contact">talk to us</Link>.
              </p>
            </div>
            <div className="et-h2-faq">
              {FAQ.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>
                    {f.q}
                    <Plus size={18} aria-hidden="true" />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 13. Final call to action */}
        <section className="et-h2-final">
          <h2>Your next skill starts today.</h2>
          <p>
            Join Etivio free. Pick a course, find your people and start moving.
          </p>
          <div className="et-h2-hero-ctas is-center">
            <Link href="/signup" className="et-h2-btn is-blue is-lg">
              Get started free <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/explore" className="et-h2-btn is-line-white is-lg">
              Browse courses
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

// 6. A few published courses, starred ones first. Hidden until there are some.
async function Courses() {
  const courses = (await getCatalog(12))
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured))
    .slice(0, 4);
  if (!courses.length) return null;
  return (
    <section className="et-h2-sec">
      <div className="et-h2-row-head">
        <div className="et-h2-head">
          <span className="et-h2-kicker">Popular now</span>
          <h2>Courses worth your time.</h2>
        </div>
        <Link href="/explore" className="et-h2-btn is-line">
          See all courses <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <div className="et-h2-courses">
        {courses.map((c) => (
          <Link key={c.id} href={`/courses/${c.slug}`} className="et-h2-course">
            <div className="et-h2-course-cover">
              {c.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.coverUrl} alt="" />
              ) : (
                <BookOpen size={30} strokeWidth={1.6} />
              )}
              <span>{c.level}</span>
            </div>
            <div className="et-h2-course-body">
              <h3>{c.title}</h3>
              <small>
                {c.instructor} · {c.lessonCount} lessons
              </small>
              <div className="et-h2-course-foot">
                {c.rating ? (
                  <span>
                    <Star size={14} /> {c.rating.toFixed(1)}
                  </span>
                ) : (
                  <span>New</span>
                )}
                <b>{formatPrice(c.priceMinor, c.currency)}</b>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// 10. Live coaches when coaching is on, otherwise a pitch with sample sessions.
async function Coaches() {
  const on = await featureOnForVisitor("coaching");
  const coaches = on ? (await listCoaches()).slice(0, 3) : [];
  return (
    <section className="et-h2-sec is-tint">
      <div className="et-h2-row-head">
        <div className="et-h2-head">
          <span className="et-h2-kicker">Coaches</span>
          <h2>One hour with the right person changes everything.</h2>
          <p>
            Book a 1-on-1 video session for career advice, portfolio reviews or
            help getting unstuck.
          </p>
        </div>
        <Link
          href={on ? "/coaches" : "/coaches/apply"}
          className="et-h2-btn is-ink"
        >
          {on ? "Meet the coaches" : "Become a coach"}{" "}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {coaches.length ? (
        <div className="et-h2-coaches">
          {coaches.map((c) => (
            <Link
              key={c.userId}
              href={`/coaches/${c.slug}`}
              className="et-h2-coach"
            >
              <Avatar
                src={c.avatar}
                initial={c.name.charAt(0).toUpperCase()}
                seed={c.name}
                className="et-h2-coach-av"
              />
              <b>{c.name}</b>
              {c.headline && <p>{c.headline}</p>}
              <div className="et-h2-coach-foot">
                <span>
                  <CalendarClock size={14} /> {c.minutes} min
                </span>
                <b>{formatPrice(c.priceMinor, c.currency)}</b>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="et-h2-coaches">
          {[
            {
              icon: Users,
              title: "Career advice",
              body: "Plan your next move with someone who has made it.",
            },
            {
              icon: ImageIcon,
              title: "Portfolio review",
              body: "Get honest feedback on your work before you apply.",
            },
            {
              icon: MessageCircle,
              title: "Mock interviews",
              body: "Practise the hard questions in a safe room.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="et-h2-coach">
              <span className="et-h2-pillar-icon">
                <Icon size={20} />
              </span>
              <b>{title}</b>
              <p>{body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const FOOT = [
  {
    title: "Platform",
    links: [
      ["/explore", "Courses"],
      ["/coaches", "Coaches"],
      ["/tutors", "Tutors"],
      ["/teach-on-etivio", "Teach on Etivio"],
    ],
  },
  {
    title: "Company",
    links: [
      ["/about", "About us"],
      ["/blog", "Blog"],
      ["/contact", "Contact"],
    ],
  },
  {
    title: "Support",
    links: [
      ["/help", "Help centre"],
      ["/certificate", "Verify a certificate"],
      ["/refund-policy", "Refund policy"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["/privacy", "Privacy"],
      ["/terms", "Terms"],
    ],
  },
];

// 13. Footer
function Footer() {
  return (
    <footer className="et-h2-foot">
      <div className="et-h2-foot-top">
        <div className="et-h2-foot-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etiviologo.svg" alt="Etivio" />
          <p>Courses, communities and coaches for learners across Africa.</p>
        </div>
        {FOOT.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <b>{col.title}</b>
            {col.links.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="et-h2-foot-base">
        <span>© Etivio Africa</span>
        <span>Learn, connect and build.</span>
      </div>
    </footer>
  );
}
