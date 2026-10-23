"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import LaserFlow from "@/components/fx/LaserFlow";
import { HeroPreview } from "./HeroPreview";

const NARROW = "(max-width: 860px)";
const PHONE = "(max-width: 520px)";
const watch = (query: string) => (cb: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const subscribeNarrow = watch(NARROW);
const subscribePhone = watch(PHONE);

// The hero's blue light beam (React Bits LaserFlow) falling onto the course player mockup, over a Teach dashboard
// screenshot that only shows around the cursor. On tablets the beam moves to the right edge so it does not run through
// the text; on phones there is no room for it, so the frame gets a static glow instead (see app.css).
export function HeroStage() {
  const frame = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const phone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);

  // Follow the cursor over the hero and reveal the dashboard screenshot around it.
  useEffect(() => {
    const el = reveal.current;
    const hero = el?.parentElement;
    if (!el || !hero) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = hero.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      el.classList.toggle("is-on", inside);
    };
    const leave = () => el.classList.remove("is-on");
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <>
      <div ref={reveal} className="et-lp-reveal" aria-hidden="true" />
      {!phone && <LaserFlow className="et-lp-laser" surfaceRef={frame} beamPosition={narrow ? 0.9 : 0.66} color="#2563eb" intensity={1.8} flare={1.5} spread={1.5} spill={1} fog={0} dust={1.6} />}
      <HeroPreview ref={frame} />
    </>
  );
}
