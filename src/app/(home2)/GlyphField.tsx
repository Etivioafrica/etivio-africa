"use client";

import { useEffect, useRef } from "react";

// A dim field of characters behind the closing call to action. A few glyphs change and glow each tick.
const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()[]{};:<>/?~+=_-|\\";
const STEP = 46;

export function GlyphField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cols = 0, rows = 0, grid: { c: string; a: number }[] = [];
    const pick = () => CHARS[Math.floor(Math.random() * CHARS.length)];

    function size() {
      const r = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = r.width * dpr;
      canvas!.height = r.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(r.width / STEP) + 1;
      rows = Math.ceil(r.height / STEP) + 1;
      grid = Array.from({ length: cols * rows }, () => ({ c: pick(), a: 0.08 + Math.random() * 0.14 }));
      draw();
    }
    function draw() {
      const r = canvas!.getBoundingClientRect();
      ctx!.clearRect(0, 0, r.width, r.height);
      ctx!.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx!.textAlign = "center";
      grid.forEach((g, i) => {
        const x = (i % cols) * STEP + 8;
        const y = Math.floor(i / cols) * STEP + 20;
        ctx!.fillStyle = `rgba(92,128,255,${g.a})`;
        ctx!.fillText(g.c, x, y);
      });
    }
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    if (still) return () => ro.disconnect();
    const t = setInterval(() => {
      for (let k = 0; k < Math.max(4, grid.length / 40); k++) {
        const g = grid[Math.floor(Math.random() * grid.length)];
        if (!g) continue;
        g.c = pick();
        g.a = Math.random() < 0.15 ? 0.55 : 0.08 + Math.random() * 0.14;
      }
      draw();
    }, 140);
    return () => {
      clearInterval(t);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="et-ft-glyphs" aria-hidden="true" />;
}
