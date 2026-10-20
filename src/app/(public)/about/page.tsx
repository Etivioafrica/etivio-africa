import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, FileText, Globe2, HandCoins, Layers, LayoutTemplate, Package, ShieldCheck, Users } from "lucide-react";
import { getSiteStats } from "@/lib/data/site";

export const metadata: Metadata = {
  title: "About Etivio | Learning built for Africa",
  description: "Etivio is where people across Africa learn practical skills and get the tools to use them: courses, templates, e-books and resource packs from creators who do the work.",
  alternates: { canonical: "/about" },
};

const BELIEFS = [
  { icon: Globe2, title: "Skills should travel", body: "Where you live shouldn't decide what you can learn. Everything on Etivio works on a phone and a normal data plan." },
  { icon: Users, title: "Learn from people who do the work", body: "Our tutors are practitioners: designers, marketers, founders and engineers teaching what they use every day." },
  { icon: HandCoins, title: "Fair pay for creators", body: "Tutors set their own prices and keep most of every sale, paid out to their local bank account." },
  { icon: ShieldCheck, title: "Proof that counts", body: "Every certificate carries an ID anyone can check, so what you've learned is easy to show." },
];

const OFFER = [
  { icon: BookOpen, title: "Courses", body: "Video and reading lessons, quizzes and a certificate at the end.", href: "/explore?type=course" },
  { icon: LayoutTemplate, title: "Templates", body: "Ready-made files you can adapt and use the same day.", href: "/explore?type=template" },
  { icon: FileText, title: "E-books and guides", body: "Deep dives you can read offline and keep forever.", href: "/explore?type=ebook" },
  { icon: Package, title: "Resource packs", body: "Checklists, swipe files and toolkits grouped by goal.", href: "/explore?type=resource_pack" },
  { icon: Layers, title: "Bundles", body: "Courses and tools together, for less than buying them one by one.", href: "/explore?type=bundle" },
];

export default function AboutPage() {
  return (
    <div className="et-mkt">
      <section className="et-mkt-hero">
        <span className="et-home-pill">About Etivio</span>
        <h1>Practical learning, made in Africa.</h1>
        <p>
          Etivio is where people across Africa learn the skills that move their careers and businesses forward, and pick up the tools to
          put them to work straight away.
        </p>
        <div className="et-home-ctas">
          <Link href="/explore" className="et-btn et-btn-primary et-home-btn">
            Explore the marketplace <ArrowRight size={16} />
          </Link>
          <Link href="/teach-on-etivio" className="et-btn et-btn-ghost et-home-btn">
            Teach on Etivio
          </Link>
        </div>
      </section>

      <Suspense fallback={null}>
        <Stats />
      </Suspense>

      <section className="et-mkt-split">
        <div>
          <h2>Our mission</h2>
          <p>
            Too much of what people need to learn is locked behind expensive programmes, foreign prices or content that doesn&apos;t fit
            how work actually happens here. Etivio exists to change that.
          </p>
          <p>
            We bring together the people who know how to do the work and the people who want to learn it, in one place, priced in naira,
            with everything you buy yours to keep.
          </p>
        </div>
        <blockquote className="et-mkt-quote">
          <Award size={22} />
          <p>Anyone, anywhere in Africa should be able to learn a skill today and use it tomorrow.</p>
        </blockquote>
      </section>

      <section className="et-home-section">
        <h2>What we believe</h2>
        <div className="et-mkt-grid-4">
          {BELIEFS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="et-card et-card-pad et-mkt-tile">
              <span className="et-set-icon">
                <Icon size={18} />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="et-home-section">
        <div className="et-home-head">
          <h2>What you&apos;ll find on Etivio</h2>
          <Link href="/explore">Browse everything</Link>
        </div>
        <div className="et-mkt-offer">
          {OFFER.map(({ icon: Icon, title, body, href }) => (
            <Link key={title} href={href} className="et-card et-card-pad et-mkt-tile is-link">
              <Icon size={20} className="et-home-step-icon" />
              <h3>{title}</h3>
              <p>{body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="et-mkt-links">
        <Link href="/tutors" className="et-card et-card-pad">
          <b>Meet the tutors</b>
          <small>The people teaching on Etivio</small>
        </Link>
        <Link href="/help" className="et-card et-card-pad">
          <b>Help centre</b>
          <small>Answers about courses, payments and downloads</small>
        </Link>
        <Link href="/blog" className="et-card et-card-pad">
          <b>Read the blog</b>
          <small>Guides, stories and news</small>
        </Link>
        <Link href="/contact" className="et-card et-card-pad">
          <b>Contact us</b>
          <small>Talk to the Etivio team</small>
        </Link>
      </section>

      <section className="et-card et-home-cta">
        <h2>Start learning today</h2>
        <p>Create your free account in under a minute.</p>
        <div className="et-home-ctas">
          <Link href="/signup" className="et-btn et-btn-primary et-home-btn">
            Get started free <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

// Live numbers only, and hidden until they're big enough to be worth showing.
async function Stats() {
  const s = await getSiteStats();
  if (s.learners < 100) return null;
  const items = [
    { label: "Courses", value: s.courses },
    { label: "Templates, e-books and packs", value: s.products },
    { label: "Tutors", value: s.tutors },
    { label: "Learners", value: s.learners },
    { label: "Certificates issued", value: s.certificates },
  ].filter((i) => i.value > 0);
  if (items.length < 2) return null;
  return (
    <section className="et-card et-mkt-stats">
      {items.map((i) => (
        <div key={i.label}>
          <b>{i.value.toLocaleString()}</b>
          <small>{i.label}</small>
        </div>
      ))}
    </section>
  );
}
