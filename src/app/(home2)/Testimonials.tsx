"use client";

import { useEffect, useState } from "react";

// PLACEHOLDER stories: replace with real learner stories (with permission) before this ships.
const VOICES = [
  {
    tab: "Web development",
    headline: "From watching tutorials to shipping a real website in six weeks",
    stat: "6 weeks",
    statLabel: "From first lesson to certificate",
    quote: "I finally finished a course instead of starting ten. The weekly goal kept me honest, and the AI tutor answered every question I was too shy to ask in class.",
    name: "Learner name",
    role: "Frontend developer, Lagos",
    face: "/avatars/02.svg",
  },
  {
    tab: "Data analysis",
    headline: "Excel and dashboards finally made sense, and work got faster",
    stat: "3 courses",
    statLabel: "Completed in one term",
    quote: "The AI tutor explained formulas the way my lecturer never did. I now build the weekly sales report in an hour instead of a whole afternoon.",
    name: "Learner name",
    role: "Analyst, Abuja",
    face: "/avatars/08.svg",
  },
  {
    tab: "Digital marketing",
    headline: "Learning on the commute turned into real sales for a small shop",
    stat: "2x",
    statLabel: "Sales after the ads module",
    quote: "I learned on my phone on the bus to work. After the ads module I ran my first proper campaign and my Instagram orders doubled.",
    name: "Learner name",
    role: "Business owner, Accra",
    face: "/avatars/05.svg",
  },
  {
    tab: "Product design",
    headline: "A verified certificate that opened the door to a first design role",
    stat: "1 offer",
    statLabel: "Within a month of finishing",
    quote: "My certificate link went straight into my CV. The recruiter checked it during the interview and we spent the rest of the call on my portfolio.",
    name: "Learner name",
    role: "UI designer, Nairobi",
    face: "/avatars/04.svg",
  },
];

export function Testimonials() {
  const [on, setOn] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => (v + 1) % VOICES.length), 8000);
    return () => clearInterval(t);
  }, [on]);
  const v = VOICES[on];

  return (
    <section className="et-h2-voice et-h2-guided is-dark">
      <span className="et-h2-mk">
        <i aria-hidden="true" /> Learner stories
      </span>
      <h2>What learners are saying</h2>

      <div className="et-h2-vc">
        <div className="et-h2-vc-tabs" role="tablist">
          {VOICES.map((x, i) => (
            <button key={x.tab} type="button" role="tab" aria-selected={i === on} className={i === on ? "is-on" : ""} onClick={() => setOn(i)}>
              {x.tab}
            </button>
          ))}
        </div>

        <div className="et-h2-vc-body" key={on} role="tabpanel">
          <div className="et-h2-vc-art" aria-hidden="true">
            <span>{v.tab}</span>
          </div>
          <div className="et-h2-vc-story">
            <h3>{v.headline}</h3>
            <div>
              <b>{v.stat}</b>
              <span>{v.statLabel}</span>
            </div>
          </div>
          <div className="et-h2-vc-quote">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.face} alt="" width={120} height={120} />
            <blockquote>&ldquo;{v.quote}&rdquo;</blockquote>
            <div>
              <b>{v.name}</b>
              <span>{v.role}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
