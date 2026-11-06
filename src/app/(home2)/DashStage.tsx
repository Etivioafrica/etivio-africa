"use client";
import { useEffect, useRef, useState } from "react";

// Under the hero: Etivio's real learner dashboard on a blue pattern. The dashboard is the app's own /tour page in
// still mode (the app's real markup and CSS with demo data), drawn at desktop size and scaled to fit, so it always
// matches the product. The Dark / Light switch changes the dashboard's theme.
// To use a photo or artwork instead of the CSS pattern, put it at /public/home/stage-bg.jpg and pass bg="/home/stage-bg.jpg".

const W = 1440;
const H = 900;
// How much of the dashboard shows before the panel's edge cuts it off: down to the "Continue learning" and "Quizzes" row,
// so the courses list below stays hidden.
const SHOWN = 0.69;

export function DashStage({ bg }: { bg?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.7);
  const [light, setLight] = useState(true);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const small = el.clientWidth < 700;
      setNarrow(small);
      setScale(el.clientWidth / (small ? 1000 : W));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pick = (isLight: boolean) => {
    setLight(isLight);
    frame.current?.contentWindow?.postMessage({ type: "et-tour", theme: isLight ? "light" : "dark" }, window.location.origin);
  };

  const fw = narrow ? 1000 : W;
  const fh = narrow ? 700 : H;

  return (
    <div className="et-x-stagewrap">
      <span className="et-x-rail" aria-hidden="true" />
      <div className={`et-x-stage${bg ? " has-img" : ""}`} style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
        {!bg && (
          <>
            <i className="p1" />
            <i className="p2" />
            <i className="p3" />
            <i className="p4" />
          </>
        )}
        <div className="et-x-card2">
          <span className="et-x-seg" role="group" aria-label="Dashboard theme">
            <button type="button" className={light ? "" : "on"} aria-pressed={!light} onClick={() => pick(false)}>
              Dark
            </button>
            <button type="button" className={light ? "on" : ""} aria-pressed={light} onClick={() => pick(true)}>
              Light
            </button>
          </span>
          <div ref={wrap} className="et-x-dashframe" style={{ height: fh * SHOWN * scale }}>
            <iframe
              ref={frame}
              src="/tour?scene=dashboard&theme=light"
              title="Etivio learner dashboard"
              loading="lazy"
              tabIndex={-1}
              aria-hidden="true"
              style={{ width: fw, height: fh, transform: `scale(${scale})` }}
            />
          </div>
        </div>
      </div>
      <b className="h tl" />
      <b className="h tr" />
      <b className="h bl" />
      <b className="h br" />
    </div>
  );
}
