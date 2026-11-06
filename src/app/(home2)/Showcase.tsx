import Link from "next/link";
import { ArrowRight, Check, Heart, MessageCircle, Sparkles } from "lucide-react";
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
    cta: { href: "/signup", label: "Try Etivio AI" },
  },
] as const;

function Lesson() {
  const items = [
    ["Install Python and set up", true],
    ["Variables and data types", true],
    ["Make decisions with if and else", false],
    ["Loops and repeating work", false],
  ] as const;
  return (
    <div className="et-x-card">
      <div className="et-x-card-bar">
        <span>LESSON 3 OF 12</span>
        <span>25%</span>
      </div>
      <div className="et-x-prog" aria-hidden="true">
        <i style={{ width: "25%" }} />
      </div>
      <h4>Python for absolute beginners</h4>
      <ul className="et-x-lessons">
        {items.map(([t, done], i) => (
          <li key={t} className={done ? "is-done" : i === 2 ? "is-now" : ""}>
            <span>{done ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Post() {
  return (
    <div className="et-x-card">
      <div className="et-x-card-bar">
        <span>CAMPUS</span>
        <span>WIN</span>
      </div>
      <div className="et-x-who">
        <span className="et-x-av">A</span>
        <div>
          <b>Amaka O.</b>
          <small>Product design · 2h</small>
        </div>
      </div>
      <p className="et-x-post">
        Just finished my first case study for the UI Foundations course. Thank you <em>@tunde</em> for the feedback on the onboarding flow!
      </p>
      <div className="et-x-post-foot">
        <span>
          <Heart size={15} /> 48
        </span>
        <span>
          <MessageCircle size={15} /> 12 replies
        </span>
      </div>
    </div>
  );
}

function Chat() {
  return (
    <div className="et-x-card">
      <div className="et-x-card-bar">
        <span>ETIVIO AI</span>
        <span>LESSON 3</span>
      </div>
      <div className="et-x-chat">
        <div className="et-x-ai">
          <span className="et-x-mark">
            <Sparkles size={13} />
          </span>
          <p>Hi! Ask me anything about this lesson.</p>
        </div>
        <div className="et-x-me">What is the difference between margin and padding?</div>
        <div className="et-x-ai">
          <span className="et-x-mark">
            <Sparkles size={13} />
          </span>
          <p>
            Padding is the space inside a box. Margin is the space outside it.
            <small>See lesson 3 at 04:12</small>
          </p>
        </div>
      </div>
    </div>
  );
}

const ART = { learn: Lesson, campus: Post, ai: Chat };

export function Showcase() {
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

      <div className="et-x-sep" aria-hidden="true">
        <span className="et-x-rail" />
        <b className="h l" />
        <b className="h r" />
      </div>

      {ROWS.map((r, i) => {
        const Art = ART[r.id];
        return (
          <section key={r.id} className={`et-x-row${i % 2 ? " is-flip" : ""}`} id={r.id === "campus" ? "campus" : undefined}>
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
              <Link href={r.cta.href} className="et-x-btn">
                {r.cta.label} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="et-x-art" aria-hidden="true">
              <Art />
            </div>
          </section>
        );
      })}
    </div>
  );
}
