"use client";
import { useState } from "react";
import { BookOpen, LayoutGrid, MessagesSquare } from "lucide-react";

// Under the hero: a product dashboard on a blue pattern, like the AgentLab hero panel. The Dark / Light switch works.
// To use a photo or artwork instead of the CSS pattern, put it at /public/home/stage-bg.jpg and pass bg="/home/stage-bg.jpg".

const WEEKS = 34;
// A fixed, repeatable pattern (no randomness, so server and browser draw the same thing): 0 = quiet day, 3 = busy day.
const level = (w: number, d: number) => {
  const n = (w * 7 + d) * 2654435761;
  const r = ((n >>> 8) & 255) / 255;
  const ramp = 0.35 + (w / WEEKS) * 0.5;
  return d > 4 ? (r > 0.85 ? 1 : 0) : r > ramp + 0.25 ? 3 : r > ramp ? 2 : r > ramp - 0.3 ? 1 : 0;
};
const COURSES: [string, number][] = [
  ["PYTHON", 22],
  ["EXCEL", 16],
  ["UI/UX", 12],
  ["CANVA", 9],
];

export function DashStage({ bg }: { bg?: string }) {
  const [light, setLight] = useState(false);
  return (
    <div className="et-x-stagewrap">
      <div className={`et-x-stage${bg ? " has-img" : ""}`} style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
        {!bg && (
          <>
            <i className="p1" />
            <i className="p2" />
            <i className="p3" />
            <i className="p4" />
          </>
        )}
        <div className={`et-x-dash${light ? " is-light" : ""}`} aria-hidden="true">
          <aside>
            <span className="logo" />
            <span className="on">
              <LayoutGrid size={15} />
            </span>
            <span>
              <BookOpen size={15} />
            </span>
            <span>
              <MessagesSquare size={15} />
            </span>
          </aside>
          <div className="main">
            <header>
              <span>
                Learn / <b>Overview</b>
              </span>
              <span className="right">
                <em>
                  <u /> 3 courses in progress
                </em>
                <span className="seg">
                  <button type="button" tabIndex={-1} className={light ? "" : "on"} onClick={() => setLight(false)}>
                    Dark
                  </button>
                  <button type="button" tabIndex={-1} className={light ? "on" : ""} onClick={() => setLight(true)}>
                    Light
                  </button>
                </span>
              </span>
            </header>
            <div className="hd">
              <div>
                <small>THIS WEEK</small>
                <h4>Welcome back, Amaka</h4>
                <p>Your lessons, your streak and what to pick up next.</p>
              </div>
              <span className="btn">Continue learning</span>
            </div>
            <div className="stats">
              <div>
                <small>Lessons completed</small>
                <b>24</b>
                <i>+6 this week</i>
              </div>
              <div>
                <small>Day streak</small>
                <b>07</b>
                <i>Best: 12 days</i>
              </div>
              <div>
                <small>Time learning</small>
                <b>3h 20m</b>
                <i>This week</i>
              </div>
            </div>
            <div className="grid">
              <section>
                <small>ACTIVITY</small>
                <h5>Lessons you finished</h5>
                <div className="heat" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
                  {Array.from({ length: WEEKS * 7 }, (_, i) => {
                    const w = Math.floor(i / 7);
                    const d = i % 7;
                    return <span key={i} className={`l${level(w, d)}`} />;
                  })}
                </div>
                <footer>
                  <span>Last 34 weeks</span>
                  <span>Each square = a day of learning</span>
                </footer>
              </section>
              <section>
                <small>MY COURSES</small>
                <h5>In progress</h5>
                {COURSES.map(([n, v]) => (
                  <div key={n} className="bar">
                    <span>{n}</span>
                    <div>
                      {Array.from({ length: 24 }, (_, i) => (
                        <i key={i} className={i < v ? "on" : ""} />
                      ))}
                    </div>
                  </div>
                ))}
                <footer>
                  <span>1 lesson due today</span>
                  <span className="btn">Resume</span>
                </footer>
              </section>
            </div>
            <div className="grid peek">
              <section>
                <small>COURSES</small>
                <h5>Picked for you</h5>
              </section>
              <section>
                <small>CAMPUS</small>
                <h5>Latest posts</h5>
              </section>
            </div>
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
