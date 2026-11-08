"use client";

import { useEffect, useRef } from "react";

// The footer wordmark drawn as a grid of small squares (dot-matrix look). The text is rendered off-screen in the
// serif font and sampled on a grid. About 1 in 25 squares glows blue at any moment: each one fades in, holds and
// fades out smoothly, then another random square takes its place. Colours are mixed solid (no transparency).
const TEXT = "Etivio Africa";
const GREY = [38, 38, 44];
const BLUE = [79, 125, 255];
const SHARE = 0.04;

type Spark = { i: number; start: number; dur: number };

export function PixelWord() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cells: { x: number; y: number }[] = [];
    let sparks: Spark[] = [];
    let cell = 10;
    let raf = 0;
    let lastW = 0;

    const newSpark = (now: number, offset = 0): Spark => ({
      i: Math.floor(Math.random() * cells.length),
      start: now - offset,
      dur: 1800 + Math.random() * 2200,
    });

    function build() {
      const w = canvas!.getBoundingClientRect().width;
      if (!w) return;
      cell = Math.max(5, Math.round(w / 230));
      const font = getComputedStyle(canvas!).getPropertyValue("--h2-serif").trim() || "Georgia";
      const off = document.createElement("canvas");
      const octx = off.getContext("2d")!;
      let size = 200;
      octx.font = `400 ${size}px ${font}, Georgia, serif`;
      size = Math.floor(size * ((w * 0.9) / octx.measureText(TEXT).width));
      octx.font = `400 ${size}px ${font}, Georgia, serif`;
      const m = octx.measureText(TEXT);
      off.width = Math.ceil(w);
      off.height = Math.ceil((m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) * 1.1);
      octx.font = `400 ${size}px ${font}, Georgia, serif`;
      octx.textAlign = "center";
      octx.fillStyle = "#fff";
      octx.fillText(TEXT, w / 2, m.actualBoundingBoxAscent * 1.05);
      const data = octx.getImageData(0, 0, off.width, off.height).data;
      cells = [];
      for (let y = 0; y < off.height; y += cell)
        for (let x = 0; x < off.width; x += cell) {
          const i = ((y + (cell >> 1)) * off.width + (x + (cell >> 1))) * 4;
          if (data[i + 3] > 128) cells.push({ x, y });
        }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.style.height = `${off.height}px`;
      canvas!.width = off.width * dpr;
      canvas!.height = off.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const now = performance.now();
      // Start each spark at a random point in its life so they don't all fade in together.
      sparks = Array.from({ length: Math.round(cells.length * SHARE) }, () => {
        const s = newSpark(now);
        s.start = now - Math.random() * s.dur;
        return s;
      });
      draw(now);
    }

    function draw(now: number) {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      const s = cell - Math.max(1, Math.round(cell * 0.18));
      ctx!.fillStyle = `rgb(${GREY.join(",")})`;
      for (const c of cells) ctx!.fillRect(c.x, c.y, s, s);
      for (let k = 0; k < sparks.length; k++) {
        let sp = sparks[k];
        let p = (now - sp.start) / sp.dur;
        if (p >= 1) {
          sp = sparks[k] = newSpark(now);
          p = 0;
        }
        const c = cells[sp.i];
        if (!c) continue;
        const v = still ? 1 : Math.sin(Math.PI * p); // 0 -> 1 -> 0
        const mix = GREY.map((g, j) => Math.round(g + (BLUE[j] - g) * v));
        ctx!.fillStyle = `rgb(${mix.join(",")})`;
        ctx!.fillRect(c.x, c.y, s, s);
      }
    }

    function loop(now: number) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w && w !== lastW) {
        lastW = w;
        build();
      }
    });

    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      lastW = Math.round(canvas.getBoundingClientRect().width);
      build();
      ro.observe(canvas);
      if (!still) raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="et-ft-pixels" role="img" aria-label="Etivio Africa" />;
}
