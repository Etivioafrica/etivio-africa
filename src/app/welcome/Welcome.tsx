"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const SLIDES = [
  { image: "/onboarding/slide-1.jpg", title: "Learn skills that pay", body: "Practical courses from people who do the work, across Africa." },
  { image: "/onboarding/slide-2.jpg", title: "Learn at your own pace", body: "Short lessons, streaks and weekly goals that keep you going." },
  { image: "/onboarding/slide-3.jpg", title: "Earn real certificates", body: "Finish a course and get a certificate anyone can verify." },
];

// The app's start screen: a short branded splash, then full-screen slides with sign-up and log-in.
export function Welcome() {
  const [splash, setSplash] = useState(true);
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setSplash(false), reduce ? 0 : 1700);
    return () => clearTimeout(t);
  }, []);

  // Moves to the next slide every 4 seconds, after the splash.
  useEffect(() => {
    if (splash) return;
    const t = setInterval(() => {
      const el = scroller.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % SLIDES.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 4000);
    return () => clearInterval(t);
  }, [splash]);

  const go = (i: number) => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: "smooth" });

  return (
    <div className="et-welcome">
      <div ref={scroller} className="et-welcome-track" onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {SLIDES.map((s, i) => (
          <section key={s.image} className="et-welcome-slide" aria-hidden={i !== active}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.image} alt="" fetchPriority={i === 0 ? "high" : "auto"} />
            <div className="et-welcome-text">
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </div>
          </section>
        ))}
      </div>

      <header className="et-welcome-top">
        <div className="et-welcome-bars">
          {SLIDES.map((s, i) => (
            <button key={s.title} type="button" onClick={() => go(i)} aria-label={`Slide ${i + 1}`}>
              <span className={i === active ? "is-on" : undefined} />
            </button>
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/etiviologo.svg" alt="Etivio" className="et-welcome-logo" />
      </header>

      <div className="et-welcome-actions">
        <Link href="/signup?next=/learn" className="et-welcome-primary">
          Create account
        </Link>
        <Link href="/login?next=/learn" className="et-welcome-secondary">
          Log in
        </Link>
      </div>

      <div className={`et-splash${splash ? "" : " is-done"}`} aria-hidden={!splash}>
        <span className="et-splash-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etivio-mark.svg" alt="" />
        </span>
        <span className="et-splash-word">
          etivio
          <i />
        </span>
      </div>
    </div>
  );
}
