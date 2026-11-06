"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Send } from "lucide-react";
import { AiAvatar } from "@/components/learn/AiAvatar";

// Looping, hands-off demos for the Learn and Etivio AI cards on the home page (the Campus one is CampusSim). Each only
// runs while on screen; with reduced motion each shows its finished state.
const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (cb: () => void) => {
  const m = window.matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

// Runs `script` over and over while the element is at least a third on screen. `script` gets a wait() that never resolves
// once the loop is stopped, so a stale run can't touch state.
function useLoop(script: (wait: (ms: number) => Promise<void>) => Promise<void>) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
  const run = useRef(script);
  useEffect(() => {
    run.current = script;
  });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible) return;
    let dead = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));
    (async () => {
      while (!dead) await run.current(wait);
    })();
    return () => {
      dead = true;
      timers.forEach(clearTimeout);
    };
  }, [visible, reduced]);

  return { root, reduced };
}

/* ---------------- Learn: a lesson list that ticks off as you go ---------------- */
const LESSONS = ["Install Python and set up", "Variables and data types", "Make decisions with if and else", "Loops and repeating work", "Functions you can reuse"];

export function LessonSim() {
  const [live, setLive] = useState(2);
  const [press, setPress] = useState(false);
  const { root, reduced } = useLoop(async (wait) => {
    setLive(2);
    for (let d = 2; d < LESSONS.length; d++) {
      await wait(1600);
      setPress(true);
      await wait(320);
      setPress(false);
      setLive(d + 1);
    }
    await wait(2600);
  });
  const done = reduced ? LESSONS.length : live;
  const pct = Math.round(((done + 1) / 12) * 100);
  const finished = done >= LESSONS.length;

  return (
    <div className="et-x-card et-lsim" ref={root}>
      <div className="et-x-card-bar">
        <span>LESSON {done + 1} OF 12</span>
        <span>{pct}%</span>
      </div>
      <div className="et-x-prog" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
      <h4>Python for absolute beginners</h4>
      <ul className="et-x-lessons">
        {LESSONS.map((t, i) => (
          <li key={t} className={i < done ? "is-done" : i === done ? "is-now" : ""}>
            <span>{i < done ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
            {t}
          </li>
        ))}
      </ul>
      <div className="et-lsim-foot">
        <span className={`et-lsim-btn${press ? " is-press" : ""}${finished ? " is-off" : ""}`}>{finished ? "Lesson complete" : "Mark complete"}</span>
      </div>
    </div>
  );
}

/* ---------------- Etivio AI: a question typed, sent, and answered ---------------- */
const QUESTION = "What is the difference between margin and padding?";
const ANSWER = "Padding is the space inside a box. Margin is the space outside it.".split(" ");

export function ChatSim() {
  const [typed, setTyped] = useState("");
  const [sent, setSent] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [words, setWords] = useState(0);
  const [cite, setCite] = useState(false);
  const [press, setPress] = useState(false);
  const { root, reduced } = useLoop(async (wait) => {
    setTyped("");
    setSent(false);
    setThinking(false);
    setWords(0);
    setCite(false);
    await wait(1500);
    for (let i = 1; i <= QUESTION.length; i++) {
      setTyped(QUESTION.slice(0, i));
      await wait(34 + (i % 3) * 8);
    }
    await wait(600);
    setPress(true);
    await wait(320);
    setPress(false);
    setSent(true);
    setTyped("");
    setThinking(true);
    await wait(1300);
    setThinking(false);
    for (let w = 1; w <= ANSWER.length; w++) {
      setWords(w);
      await wait(130);
    }
    await wait(450);
    setCite(true);
    await wait(4200);
  });
  const isSent = reduced || sent;
  const n = reduced ? ANSWER.length : words;
  const showCite = reduced || cite;

  return (
    <div className="et-x-card et-csim" ref={root}>
      <div className="et-x-card-bar">
        <span>ETIVIO AI</span>
        <span>LESSON 3</span>
      </div>
      <div className="et-csim-feed">
        <div className="et-x-ai">
          <AiAvatar size={30} />
          <p>Hi! Ask me anything about this lesson.</p>
        </div>
        {isSent && <div className="et-x-me et-csim-in">{QUESTION}</div>}
        {thinking && (
          <div className="et-x-ai et-csim-in">
            <AiAvatar size={30} busy />
            <p className="et-csim-dots" aria-label="Thinking">
              <i />
              <i />
              <i />
            </p>
          </div>
        )}
        {n > 0 && (
          <div className="et-x-ai et-csim-in">
            <AiAvatar size={30} />
            <p>
              {ANSWER.slice(0, n).join(" ")}
              {showCite && <small className="et-csim-in">See lesson 3 at 04:12</small>}
            </p>
          </div>
        )}
      </div>
      <div className="et-csim-input">
        <span className={typed ? "has-text" : undefined}>{typed || "Ask Etivio AI…"}</span>
        <b className={`et-csim-send${typed ? " is-ready" : ""}${press ? " is-press" : ""}`}>
          <Send size={15} />
        </b>
      </div>
    </div>
  );
}
