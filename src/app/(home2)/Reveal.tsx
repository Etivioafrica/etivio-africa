"use client";
import { useEffect, useRef, useState } from "react";

// A big statement whose words turn from grey to white as it scrolls up the screen (AgentLab style).
// Everything is white until the page has mounted, and for people who prefer reduced motion.
export function Reveal({ text }: { text: string }) {
  const el = useRef<HTMLHeadingElement>(null);
  const words = text.split(" ");
  const [lit, setLit] = useState(words.length);

  useEffect(() => {
    const node = el.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = node.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the heading enters at the bottom of the screen, 1 once it has reached the upper middle.
      const p = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 0.5)));
      setLit(Math.round(p * words.length));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [words.length]);

  return (
    <h2 ref={el} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" className={i < lit ? "on" : ""}>
          {w}{" "}
        </span>
      ))}
    </h2>
  );
}
