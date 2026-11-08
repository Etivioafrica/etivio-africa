import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AiDemo } from "./AiDemo";
import { ChatSim, LessonSim } from "./ArtSims";
import { CampusSim } from "./CampusSim";
import { DashStage } from "./DashStage";
import { Problem } from "./Problem";
import { Reveal } from "./Reveal";
import { Ticker } from "./Ticker";

// Block 1 of the rebuilt home page (after the hero): a statement, then three alternating feature rows
// in the AgentLab style: serif headings, thin borders, arrow lists and a blue art panel with a product mock inside.

const ROWS = [
  {
    id: "campus",
    label: "Campus",
    title: "So we built Campus: your learning feed, with real people in it.",
    body: "Share notes, templates and wins, ask questions and meet smart people who are learning what you are. Add photos and video links, mention classmates and get replies as they happen.",
    points: ["Updates, questions, wins, polls and opportunities", "Photos, video links and @mentions", "Save posts and follow the topics you care about"],
    cta: { href: "/signup", label: "Join Campus" },
  },
  {
    id: "learn",
    label: "Learn",
    title: "Short, practical lessons that fit your day.",
    body: "Every course is broken into small lessons with notes, bookmarks and quizzes, so you can learn a little every day and see your progress grow.",
    points: ["Notes, bookmarks and quizzes in every course", "Certificates anyone can check online", "Free and paid courses, priced in naira"],
    cta: { href: "/explore", label: "Browse courses" },
  },
  {
    id: "ai",
    label: "Etivio AI",
    title: "A study partner that knows your lessons.",
    body: "Stuck on a lesson at midnight? Ask Etivio AI. It explains ideas in plain words, quizzes you and points you to the exact lesson to revisit.",
    points: ["Explains in plain, simple English", "Quizzes you on what you just learned", "Knows the course you are taking"],
    cta: { href: "/signup", label: "Try Etivio AI", demo: true },
  },
] as const;

const ART = { learn: LessonSim, campus: CampusSim, ai: ChatSim };

export function Showcase({ courses }: { courses?: ReactNode }) {
  return (
    <div className="et-x" id="features">
      <DashStage bg="/home/stage-bg.webp" />
      <Ticker />

      <Problem />

      <section className="et-x-statement">
        <span className="et-x-label">
          <i /> Our solution
        </span>
        <Reveal text="One place to learn a skill, practise it with people, and turn it into a career." />
      </section>

      {courses && (
        <div className="et-x-sep" aria-hidden="true">
          <span className="et-x-rail" />
          <b className="h l" />
          <b className="h r" />
        </div>
      )}

      {courses}

      <div className="et-x-sep" aria-hidden="true">
        <span className="et-x-rail" />
        <b className="h l" />
        <b className="h r" />
      </div>

      <div className="et-x-built">
        <h2>What you get</h2>
        <p>Real skills you can prove, people who back you, and a clear path to your next role.</p>
        <span className="et-x-rail is-bottom" />
        <b className="h bl" />
        <b className="h br" />
      </div>

      {ROWS.map((r, i) => {
        const Art = ART[r.id];
        return (
          <Fragment key={r.id}>
            {i > 0 && (
              <div className="et-x-sep" aria-hidden="true">
                <span className="et-x-rail" />
                <b className="h l" />
                <b className="h r" />
              </div>
            )}
          <section className={`et-x-row${i % 2 ? " is-flip" : ""}`} id={r.id === "campus" ? "campus" : undefined}>
            <div className="et-x-copy">
              <span className="et-x-label">
                <i /> {r.label}
              </span>
              <h3>{r.title}</h3>
              <p>{r.body}</p>
              <ul>
                {r.points.map((p) => (
                  <li key={p}>
                    <ArrowRight size={16} aria-hidden="true" /> {p}
                  </li>
                ))}
              </ul>
              {"demo" in r.cta ? (
                <AiDemo label={r.cta.label} />
              ) : (
                <Link href={r.cta.href} className="et-x-btn">
                  {r.cta.label} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              )}
            </div>
            <div className="et-x-art" aria-hidden="true">
              <Art />
            </div>
          </section>
          </Fragment>
        );
      })}
    </div>
  );
}
