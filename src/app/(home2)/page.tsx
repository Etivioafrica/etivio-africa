import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Star,
} from "lucide-react";
import { getCatalog } from "@/lib/data/learn";
import { formatPrice } from "@/lib/format";
import { Caveat, Newsreader } from "next/font/google";
import { FaqBlock } from "@/components/faq/FaqBlock";
import { Capabilities } from "./Capabilities";
import { Impact, Paths, Trust, Voices } from "./MoreSections";
import { HeroCta } from "./HeroCta";
import { SiteFooter } from "./SiteFooter";
import { HeroReel } from "./HeroReel";
import { Home2Nav } from "./Home2Nav";
import { Showcase } from "./Showcase";
import { WishlistHeart } from "./WishlistHeart";
import "./home2.css";

export const metadata: Metadata = {
  title: "Etivio | Learn, connect and build",
  description:
    "Courses, a learner feed and an AI study partner, built for learners across Africa.",
};

const FAQ = [
  {
    q: "Is Etivio free to join?",
    a: "Yes. Creating an account and posting on Campus are free. Some courses are free and others are paid; the price is always shown before you enrol.",
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

const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--h2-serif",
  display: "swap",
});

const hand = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--h2-hand",
});

export default function Home2() {
  return (
    <div className={`et-h2 ${hand.variable} ${serif.variable}`}>
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
              Practical <b>courses</b>, a <b>Campus</b> feed that keeps you
              going, and an <b>AI study partner</b> that knows your lessons.
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

        {/* 4. Statement and feature rows (AgentLab-style block) */}
        <Showcase
          courses={
            <Suspense fallback={null}>
              <Courses />
            </Suspense>
          }
        />

        <Paths />

        <Capabilities />

        <Impact />

        <Voices />

        <Trust />

        {/* 10. FAQ */}
        <section className="et-h2-sec et-h2-guided">
          <div className="et-h2-knots" aria-hidden="true">
            <span className="et-x-rail" />
            <b className="l" />
            <b className="r" />
          </div>
          <FaqBlock
            title={["Have questions?", "Find answers."]}
            items={FAQ}
            name="home-faq"
            more={{ title: "Have more questions?", body: "Reach out to our friendly support team.", href: "/contact", label: "Talk to us" }}
          />
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}

// 6. A few published courses, starred ones first. Hidden until there are some.
async function Courses() {
  const courses = (await getCatalog(12))
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured))
    .slice(0, 8);
  if (!courses.length) return null;
  return (
    <section className="et-h2-sec">
      <div className="et-h2-row-head">
        <div className="et-h2-head">
          <span className="et-h2-kicker">Popular now</span>
          <h2>Handpicked courses for you.</h2>
        </div>
        <Link href="/explore" className="et-h2-btn is-line">
          See all courses <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <div className="et-h2-courses">
        {courses.map((c) => (
          <article key={c.id} className="et-h2-course">
            <Link href={`/courses/${c.slug}`} className="et-h2-course-link">
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
            <div className="et-h2-course-acts">
              <Link href={`/courses/${c.slug}`} className="et-h2-enrol">
                Enrol now <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <WishlistHeart courseId={c.id} title={c.title} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
