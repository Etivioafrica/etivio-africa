import type { Ref } from "react";
import { Check, ChevronDown, ChevronRight, ChevronUp, FileText, Maximize, PanelRightClose, Play, PlayCircle, RotateCcw, RotateCw, Share2, Trophy, Volume2 } from "lucide-react";

const SECTIONS = [
  { title: "Section 1: Welcome and how the web works", meta: "0 / 4 | 35 min" },
  {
    title: "Section 2: HTML basics",
    meta: "1 / 3 | 21 min",
    open: true,
    lessons: [
      { title: "5. Overview: HTML basics", meta: "2 min", doc: true, done: true },
      { title: "6. HTML for beginners", meta: "12 min", current: true },
      { title: "7. HTML and CSS together", meta: "7 min" },
    ],
  },
  { title: "Section 3: Build your first website", meta: "0 / 4 | 32 min" },
  { title: "Section 4: CSS selectors and layout", meta: "0 / 3 | 20 min" },
  { title: "Section 5: Images and responsive design", meta: "0 / 4 | 51 min" },
  { title: "Section 6: JavaScript fundamentals", meta: "0 / 5 | 46 min" },
  { title: "Section 7: JavaScript and the page", meta: "0 / 4 | 47 min" },
  { title: "Section 8: How JavaScript really works", meta: "0 / 4 | 17 min" },
];

// Coded mockup of the course player, shown under the hero. The hero's light beam lands on this frame.
export function HeroPreview({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="et-lp-frame" role="img" aria-label="The Etivio course player: a lesson video playing next to the course content list">
      <div className="et-lp-mock" aria-hidden="true">
        <div className="et-lp-mock-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etiviologo.svg" alt="" className="et-lp-mock-logo" />
          <span className="et-lp-mock-title">Web Development for Beginners: HTML, CSS &amp; JavaScript</span>
          <span className="et-lp-mock-progress">
            <Trophy size={13} /> Your progress <ChevronDown size={13} />
          </span>
          <span className="et-lp-mock-share">
            <Share2 size={13} /> Share
          </span>
        </div>

        <div className="et-lp-mock-body">
          <div className="et-lp-mock-main">
            <div className="et-lp-mock-video">
              {/* Placeholder lesson still; swap the file for the real one */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/herob.jpeg" alt="" className="et-lp-mock-still" />
              <span className="et-lp-mock-play">
                <Play size={26} fill="currentColor" />
              </span>
              <div className="et-lp-mock-controls">
                <div className="et-lp-mock-scrub">
                  <span />
                </div>
                <div className="et-lp-mock-ctrl-row">
                  <Play size={13} fill="currentColor" />
                  <RotateCcw size={13} />
                  <RotateCw size={13} />
                  <span>3:24 / 11:57</span>
                  <i />
                  <span>1x</span>
                  <Volume2 size={13} />
                  <Maximize size={13} />
                </div>
              </div>
            </div>

            <div className="et-lp-mock-lesson">
              <div>
                <small>HTML basics</small>
                <b>HTML for beginners</b>
              </div>
              <span className="et-lp-mock-btn is-primary">
                <Check size={13} /> Complete and continue
              </span>
              <span className="et-lp-mock-btn">
                Next lesson <ChevronRight size={13} />
              </span>
            </div>
            <div className="et-lp-mock-tabs">
              <span className="is-active">Overview</span>
              <span>Notes</span>
              <span>Support</span>
              <span>Announcements</span>
            </div>
            <div className="et-lp-mock-overview">
              <b>About this lesson</b>
              <p>Write your first web page from scratch. You will set up a document, add a heading, and see it come alive in the browser.</p>
              <div className="et-lp-mock-chips">
                <span>HTML</span>
                <span>12 min</span>
                <span>Beginner</span>
              </div>
            </div>
          </div>

          <div className="et-lp-mock-side">
            <div className="et-lp-mock-side-head">
              Course content <PanelRightClose size={14} />
            </div>
            {SECTIONS.map((s) => (
              <div key={s.title} className="et-lp-mock-sec">
                <div className="et-lp-mock-sec-head">
                  <div>
                    <b>{s.title}</b>
                    <small>{s.meta}</small>
                  </div>
                  {s.open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
                {s.lessons?.map((l) => (
                  <div key={l.title} className={`et-lp-mock-item${l.current ? " is-current" : ""}`}>
                    <span className={`et-lp-mock-check${l.done ? " is-done" : ""}`}>{l.done && <Check size={10} />}</span>
                    <div>
                      <span>{l.title}</span>
                      <small>
                        {l.doc ? <FileText size={11} /> : <PlayCircle size={11} />} {l.meta}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
