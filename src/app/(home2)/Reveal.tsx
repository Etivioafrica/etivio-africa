"use client";
import { useEffect, useRef, useState } from "react";

// A big statement that fills with colour, word by word, as it scrolls up the screen: each word's fill spreads left to
// right, so it reads as one smooth sweep. Fully filled until the page has mounted, and for people who prefer reduced motion.
export function Reveal({ text }: { text: string }) {
  const el = useRef<HTMLHeadingElement>(null);
  const words = text.split(" ");
  const [p, setP] = useState(1);

  useEffect(() => {
    const node = el.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = node.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the heading enters at the bottom of the screen, 1 once it has reached the upper middle.
      setP(Math.min(1, Math.max(0, (vh * 0.92 - r.top) / (vh * 0.5))));
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
  }, []);

  return (
    <h2 ref={el} aria-label={text}>
      {words.map((w, i) => (
        <span key={i}>
          <span aria-hidden="true" style={{ "--f": Math.min(1, Math.max(0, p * words.length - i)) } as React.CSSProperties}>
            {w}
          </span>{" "}
        </span>
      ))}
    </h2>
  );
}
