import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Award, HeartHandshake, Lightbulb } from "lucide-react";
import { getPublicTutors, getSiteStats } from "@/lib/data/site";
import { Home2Nav } from "../Home2Nav";
import { SiteFooter } from "../SiteFooter";
import { hand, serif } from "../fonts";
import "../home2.css";

export const metadata: Metadata = {
  title: "About Etivio | Learning built for Africa",
  description: "Etivio is where people across Africa learn practical skills: short courses from people who do the work, an AI tutor that knows your lessons, and certificates anyone can check.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  { icon: HeartHandshake, title: "Learners first", body: "Every decision starts with the person trying to learn, on a phone, on a normal data plan, with a busy life." },
  { icon: Lightbulb, title: "Practical over theory", body: "We teach skills you can use tomorrow, from tutors who do the work every day, not just talk about it." },
  { icon: Award, title: "Quality you can trust", body: "Our team reviews every new course before it goes live, and every certificate can be checked by anyone." },
];

// Topics Etivio is recruiting tutors for. Each opens the tutor application.
const ROLES = [
  { title: "Software and web development tutors", where: "Remote, anywhere in Africa", area: "Technology" },
  { title: "Data and analytics tutors", where: "Remote, anywhere in Africa", area: "Technology" },
  { title: "Product and UI design tutors", where: "Remote, anywhere in Africa", area: "Design" },
  { title: "Digital marketing tutors", where: "Remote, anywhere in Africa", area: "Marketing" },
  { title: "Business, finance and sales tutors", where: "Remote, anywhere in Africa", area: "Business" },
  { title: "Career and personal growth coaches", where: "Remote, anywhere in Africa", area: "Coaching" },
];

function Knots() {
  return (
    <div className="et-h2-knots" aria-hidden="true">
      <span className="et-x-rail" />
      <b className="l" />
      <b className="r" />
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className={`et-h2 ${hand.variable} ${serif.variable}`}>
      <Home2Nav />
      <main className="et-ab">
        {/* Hero */}
        <section className="et-ab-hero et-h2-guided">
          <span className="et-h2-mk">
            <i aria-hidden="true" /> About Etivio
          </span>
          <h1>We build the place Africa learns practical skills.</h1>
          <div className="et-ab-btns">
            <Link href="/signup" className="et-ab-btn is-solid">
              <span>
                <ArrowRight size={15} aria-hidden="true" />
              </span>
              Start learning
            </Link>
            <a href="#teach" className="et-ab-btn">
              Teach on Etivio
            </a>
          </div>
        </section>

        {/* Live numbers */}
        <Suspense fallback={null}>
          <Stats />
        </Suspense>

        {/* Mission */}
        <section className="et-ab-sec et-h2-guided">
          <Knots />
          <span className="et-h2-mk">
            <i aria-hidden="true" /> Mission
          </span>
          <p className="et-ab-mission">
            Anyone, anywhere in Africa should be able to learn a skill today and use it tomorrow. <span>We want Etivio to be where a
            million Africans learn the skills that move their careers and businesses forward, from tutors who have done the work
            and with proof that employers trust.</span>
          </p>
        </section>

        {/* Values */}
        <section className="et-ab-sec et-h2-guided is-tint">
          <Knots />
          <span className="et-h2-mk">
            <i aria-hidden="true" /> Our values
          </span>
          <h2>The principles that guide everything we do</h2>
          <div className="et-ab-values">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <article key={title}>
                <span>
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Story */}
        <section className="et-ab-sec et-h2-guided">
          <Knots />
          <div className="et-ab-story">
            <span className="et-h2-mk">
              <i aria-hidden="true" /> Our story
            </span>
            <div>
              <p>
                We kept meeting people with the drive to learn and nowhere good to do it. Courses were built for other markets,
                priced in other currencies, and too heavy for a phone on a normal data plan. Learning alone, most people stopped
                halfway.
              </p>
              <p>
                So we built Etivio: short practical courses from African tutors, an AI study partner that knows your lessons, a
                Campus to learn alongside others, and certificates anyone can verify. We are just getting started.
              </p>
              <small>The Etivio team</small>
            </div>
          </div>
        </section>

        {/* Tutors */}
        <Suspense fallback={null}>
          <Tutors />
        </Suspense>

        {/* Teach on Etivio */}
        <section className="et-ab-sec et-h2-guided is-dark" id="teach">
          <Knots />
          <span className="et-h2-mk">
            <i aria-hidden="true" /> Teach on Etivio
          </span>
          <h2>We&apos;re recruiting tutors</h2>
          <p className="et-ab-lead">Know something worth teaching? Etivio is building a team of tutors and coaches across Africa. Here is who we are looking for right now.</p>
          <div className="et-ab-roles">
            {ROLES.map((r) => (
              <Link key={r.title} href="/teach-on-etivio">
                <div>
                  <h3>{r.title}</h3>
                  <span>
                    {r.where} · {r.area}
                  </span>
                </div>
                <ArrowUpRight size={20} aria-hidden="true" />
              </Link>
            ))}
          </div>
          <div className="et-ab-more">
            <div>
              <b>Don&apos;t see your topic?</b>
              <p>Tell us what you teach and we will get back to you.</p>
            </div>
            <Link href="/contact" className="et-ab-btn">
              Contact us
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

async function Stats() {
  const s = await getSiteStats();
  const items = [
    { label: "Learners on Etivio", value: s.learners },
    { label: "Published courses", value: s.courses },
    { label: "Certificates issued", value: s.certificates },
  ];
  // Only show real numbers once they mean something.
  if (s.learners < 100) return null;
  return (
    <section className="et-ab-stats et-h2-guided">
      {items.map((i) => (
        <div key={i.label}>
          <b>{i.value.toLocaleString("en-NG")}</b>
          <span>{i.label}</span>
        </div>
      ))}
    </section>
  );
}

async function Tutors() {
  const tutors = (await getPublicTutors()).slice(0, 4);
  if (!tutors.length) return null;
  return (
    <section className="et-ab-sec et-h2-guided is-tint">
      <Knots />
      <span className="et-h2-mk">
        <i aria-hidden="true" /> The people teaching
      </span>
      <h2>Meet our tutors</h2>
      <div className="et-ab-team">
        {tutors.map((t) => (
          <Link key={t.id} href={`/@${t.username}`}>
            {t.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.avatar} alt="" />
            ) : (
              <span className="et-ab-team-init">{t.name.charAt(0)}</span>
            )}
            <b>{t.name}</b>
            <span>{t.headline || (t.courses ? `${t.courses} course${t.courses === 1 ? "" : "s"} on Etivio` : "Tutor on Etivio")}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
