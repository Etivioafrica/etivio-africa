"use client";
import { useEffect, useRef } from "react";

// Each portrait appears twice in the loop, ordered so men and women alternate.
const PEOPLE = [2, 1, 3, 5, 4, 6, 7].map((n) => `/home2/people-${n}.jpg`);
const PHOTOS = [...PEOPLE, ...PEOPLE];

// An endless strip of photos. Each frame turns toward the viewer and grows as it nears the edges, so the row
// reads as the inside of a curve. Pauses on hover, off screen, and for reduced motion.
export function HeroReel() {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    const box = wrap.current;
    const strip = track.current;
    if (!box || !strip) return;
    const items = Array.from(strip.children) as HTMLElement[];
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = 0;
    let half = 0;
    let centers: number[] = [];
    let last = performance.now();
    let raf = 0;
    let visible = true;

    const measure = () => {
      half = strip.scrollWidth / 2;
      centers = items.map((el) => el.offsetLeft + el.offsetWidth / 2);
    };
    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!still && !paused.current) {
        x -= dt * 0.045;
        if (x <= -half) x += half;
      }
      strip.style.transform = `translate3d(${x}px,0,0)`;
      const mid = box.clientWidth / 2;
      items.forEach((el, i) => {
        const n = Math.max(-1.3, Math.min(1.3, (centers[i] + x - mid) / mid));
        el.style.transform = `perspective(1100px) rotateY(${-n * 26}deg) scale(${1 + Math.abs(n) * 0.16})`;
      });
      raf = visible ? requestAnimationFrame(frame) : 0;
    };

    measure();
    raf = requestAnimationFrame(frame);
    const resize = new ResizeObserver(measure);
    resize.observe(strip);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    seen.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      seen.disconnect();
    };
  }, []);

  return (
    <div className="et-h2-reel" ref={wrap} aria-hidden="true" onPointerEnter={() => (paused.current = true)} onPointerLeave={() => (paused.current = false)}>
      <div className="et-h2-reel-track" ref={track}>
        {[0, 1].map((copy) =>
          PHOTOS.map((p, i) => (
            <figure key={`${copy}-${i}`} className="et-h2-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" width={576} height={720} loading={i < 6 && copy === 0 ? "eager" : "lazy"} draggable={false} />
            </figure>
          )),
        )}
      </div>
    </div>
  );
}
