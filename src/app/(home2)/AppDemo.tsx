"use client";
import { useEffect, useRef, useState } from "react";
import { AtSign, Award, LogIn, PlayCircle, School, UserRound, type LucideIcon } from "lucide-react";

// Home page product tour: the /tour page (the real app, playing itself) in an iframe drawn at desktop size and scaled
// to fit, so the app's own CSS lays it out exactly as it is. The chapter tabs below follow it and jump to a chapter.

const W = 1440;
const H = 900;
const CHAPTERS: { label: string; icon: LucideIcon; caption: string }[] = [
  { label: "Sign up", icon: LogIn, caption: "Create your free account in under a minute." },
  { label: "Username", icon: AtSign, caption: "Pick the name people find and @mention you by." },
  { label: "Badge", icon: Award, caption: "Earn badges from day one as you learn." },
  { label: "Profile", icon: UserRound, caption: "A public profile with your skills, badges and certificates." },
  { label: "Campus", icon: School, caption: "Share wins, ask questions and find opportunities with other learners." },
  { label: "Learn", icon: PlayCircle, caption: "Pick up where you left off and watch your next lesson." },
];

export function AppDemo() {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [chapter, setChapter] = useState({ at: 0, ms: 14400, run: 0 });
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const send = (data: object) => frame.current?.contentWindow?.postMessage({ type: "et-tour", ...data }, window.location.origin);
    let visible = false;
    const fit = () => setScale(Math.min(1, el.clientWidth / W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    // Load the tour when it comes near, and play it only while it's on screen.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setLoad(true);
        visible = e.intersectionRatio >= 0.3;
        send({ play: visible });
      },
      { threshold: [0, 0.3], rootMargin: "200px 0px" },
    );
    io.observe(el);
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "et-tour") return;
      if (e.data.ready) send({ play: visible && !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
      if (typeof e.data.at === "number" && e.data.first) setChapter((c) => ({ at: e.data.at, ms: e.data.ms, run: c.run + 1 }));
    };
    window.addEventListener("message", on);
    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("message", on);
    };
  }, []);

  const pick = (i: number) => frame.current?.contentWindow?.postMessage({ type: "et-tour", chapter: i, play: true }, window.location.origin);

  return (
    <div className="et-h2-demo">
      <div ref={wrap} className="et-h2-demo-stage" style={{ height: H * scale }}>
        {load && (
          <iframe
            ref={frame}
            src="/tour"
            title="A walk through Etivio"
            className="et-h2-demo-frame"
            tabIndex={-1}
            style={{ width: W, height: H, transform: `scale(${scale})` }}
          />
        )}
      </div>
      <nav className="et-h2-demo-tabs" aria-label="Product tour">
        {CHAPTERS.map((c, i) => (
          <button key={c.label} type="button" className={i === chapter.at ? "is-on" : ""} onClick={() => pick(i)} aria-pressed={i === chapter.at}>
            <c.icon size={16} />
            {c.label}
            {i === chapter.at && <span className="et-h2-demo-bar" key={chapter.run} style={{ animationDuration: `${chapter.ms}ms` }} />}
          </button>
        ))}
      </nav>
      <p className="et-h2-demo-cap" aria-live="polite">
        {CHAPTERS[chapter.at].caption}
      </p>
    </div>
  );
}
