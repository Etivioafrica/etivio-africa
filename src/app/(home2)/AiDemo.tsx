"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Send, X } from "lucide-react";
import { AiAvatar } from "@/components/learn/AiAvatar";

const FACES = ["/avatars/02.svg", "/avatars/08.svg", "/avatars/05.svg", "/avatars/04.svg"];

const IDEAS = [
  "What is the difference between margin and padding?",
  "Explain inflation like I'm 12",
  "How do I start a career in data analysis?",
  "Which Etivio course should I take to learn design?",
];

type Turn = { q: string; a: string; done: boolean };

export function AiDemo({ label }: { label: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [limited, setLimited] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setQ("");
    setError("");
    setBusy(true);
    setTurns((t) => [...t, { q: question, a: "", done: false }]);
    const patch = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)));

    try {
      const res = await fetch("/api/ai/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (res.status === 429) {
        setLimited(true);
        setTurns((all) => all.slice(0, -1));
        return;
      }
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Etivio AI couldn't answer just now.");
      }
      const r = res.headers.get("X-Remaining");
      if (r !== null) setLeft(Number(r));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        patch((t) => ({ ...t, a: t.a + chunk }));
      }
      patch((t) => ({ ...t, done: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setTurns((all) => all.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  const answered = turns.some((t) => t.done);
  const outOfTries = limited || left === 0;

  return (
    <>
      <button type="button" className="et-x-btn" onClick={() => dlg.current?.showModal()}>
        {label} <ArrowRight size={15} aria-hidden="true" />
      </button>

      <dialog
        ref={dlg}
        className="et-ai-demo"
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
        aria-label="Try Etivio AI"
      >
        <div className="et-ai-demo-in">
          <header>
            <span>
              <AiAvatar size={26} /> Etivio AI
            </span>
            <button type="button" aria-label="Close" onClick={() => dlg.current?.close()}>
              <X size={18} />
            </button>
          </header>

          <div className="et-ai-demo-body">
            {turns.length === 0 && (
              <div className="et-ai-demo-empty">
                <AiAvatar size={56} />
                <h3>Ask anything.</h3>
                <p>A lesson you are stuck on, a career question or something you are curious about. No account needed.</p>
                <div className="et-ai-demo-ideas">
                  {IDEAS.map((i) => (
                    <button key={i} type="button" onClick={() => ask(i)}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i} className="et-ai-demo-turn">
                <div className="is-q">
                  <p>{t.q}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/avatars/03.svg" alt="" width={32} height={32} />
                </div>
                <div className="is-a">
                  <AiAvatar size={32} busy={!t.done} />
                  <p>{t.a || <span className="et-ai-demo-dots" aria-label="Thinking"><i /><i /><i /></span>}</p>
                </div>
              </div>
            ))}

            {error && <p className="et-ai-demo-err">{error}</p>}

            {(answered || limited) && !busy && (
              <div className="et-ai-demo-cta">
                <span className="et-ai-demo-faces" aria-hidden="true">
                  {FACES.map((f) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={f} src={f} alt="" width={30} height={30} />
                  ))}
                </span>
                <b>{outOfTries ? "You've used your free questions." : "Happy with your reply?"}</b>
                <p>
                  Create a free account and start learning. Etivio AI then sits inside every lesson, knows your course
                  and quizzes you on it.
                </p>
                <Link href="/signup" className="et-x-btn">
                  Create a free account <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>

          {!outOfTries && (
            <form
              className="et-ai-demo-form"
              onSubmit={(e) => {
                e.preventDefault();
                ask(q);
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ask Etivio AI..."
                maxLength={500}
                autoFocus
              />
              <button type="submit" disabled={busy || !q.trim()} aria-label="Send">
                <Send size={16} />
              </button>
            </form>
          )}
          {left !== null && left > 0 && <small className="et-ai-demo-left">{left} free question{left === 1 ? "" : "s"} left</small>}
        </div>
      </dialog>
    </>
  );
}
