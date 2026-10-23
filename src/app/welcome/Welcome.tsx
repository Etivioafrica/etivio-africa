"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Each slide shows three character cards (left, centre, right) and its own line. Swap `faces` for other pictures
// (for example 3D characters) without touching the layout.
const SLIDES = [
  { faces: ["/avatars/02.svg", "/avatars/08.svg", "/avatars/04.svg"], title: "Learn skills that pay", body: "Practical courses from people who do the work, across Africa." },
  { faces: ["/avatars/06.svg", "/avatars/09.svg", "/avatars/03.svg"], title: "Learn at your own pace", body: "Short lessons, streaks and weekly goals that keep you going." },
  { faces: ["/avatars/10.svg", "/avatars/05.svg", "/avatars/07.svg"], title: "Earn real certificates", body: "Finish a course and get a certificate anyone can verify." },
];
const SEEN = "et-intro-seen";

// The app's start screen. On launch the white Etivio logo is revealed on blue (continuing the native blue splash),
// then the blue lifts away to the slides with Get started and log in. The reveal plays once per app session.
export function Welcome() {
  const [intro, setIntro] = useState<"show" | "leaving" | "done">("show");
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === "1";
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) {
      const t = setTimeout(() => setIntro("done"), 0);
      return () => clearTimeout(t);
    }
    const leave = setTimeout(() => setIntro("leaving"), 1900);
    const done = setTimeout(() => {
      setIntro("done");
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {}
    }, 2600);
    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  // In the iOS app: white status bar text on the blue logo screen, dark text on the light slides.
  useEffect(() => {
    const bar = (window as { Capacitor?: { Plugins?: { StatusBar?: { setStyle: (o: { style: string }) => Promise<void> } } } }).Capacitor?.Plugins?.StatusBar;
    void bar?.setStyle({ style: intro === "done" ? "LIGHT" : "DARK" }).catch(() => {});
    return () => void bar?.setStyle({ style: "DEFAULT" }).catch(() => {});
  }, [intro]);

  // Next slide every 4.5 seconds once the intro is gone.
  useEffect(() => {
    if (intro !== "done") return;
    const t = setInterval(() => {
      const el = scroller.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % SLIDES.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(t);
  }, [intro]);

  const go = (i: number) => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: "smooth" });
  const slide = SLIDES[active];

  return (
    <div className={`et-welcome${intro === "show" ? " is-intro" : ""}`}>
      <div className="et-welcome-stage">
        <div className="et-welcome-cards" key={active} aria-hidden="true">
          {slide.faces.map((src, i) => (
            <span key={src} className={`et-welcome-card is-${["left", "mid", "right"][i]}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </span>
          ))}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/etiviologo.svg" alt="Etivio" className="et-welcome-brand" />

        <div ref={scroller} className="et-welcome-track" onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {SLIDES.map((s, i) => (
            <section key={s.title} className="et-welcome-slide" aria-hidden={i !== active}>
              <h1>{s.title}</h1>
              <p>{s.body}</p>
            </section>
          ))}
        </div>

        <div className="et-welcome-dots">
          {SLIDES.map((s, i) => (
            <button key={s.title} type="button" onClick={() => go(i)} aria-label={`Slide ${i + 1}`} className={i === active ? "is-on" : undefined} />
          ))}
        </div>
      </div>

      <div className="et-welcome-actions">
        <Link href="/signup?next=/learn" className="et-welcome-primary">
          Get started
        </Link>
        <Link href="/login?next=/learn" className="et-welcome-secondary">
          I already have an account
        </Link>
        <p className="et-welcome-legal">
          By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>

      {intro !== "done" && (
        <div className={`et-intro${intro === "leaving" ? " is-leaving" : ""}`} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etiviologo.svg" alt="" className="et-intro-logo" />
        </div>
      )}
    </div>
  );
}
