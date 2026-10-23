"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Formatted } from "./Formatted";

type Message = { role: "user" | "assistant"; content: string };

// Study assistant tab in the course player. Answers come from the course outline and this lesson's notes.
export function AskAi({ courseId, lessonId, lessonTitle, initial, remaining: startRemaining }: { courseId: string; lessonId: string; lessonTitle: string; initial: Message[]; remaining: number }) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(startRemaining);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function ask(message: string) {
    if (busy || !message.trim()) return;
    const label = message.trim();
    setError("");
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: label }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/ai/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId, message }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "The study assistant couldn't answer just now.");
      }
      const left = Number(res.headers.get("X-Remaining"));
      if (Number.isFinite(left)) setRemaining(left);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: text }]);
      }
      if (!text.trim()) throw new Error("The study assistant didn't reply. Try asking again.");
    } catch (e) {
      setMessages((m) => (m.at(-1)?.role === "assistant" && !m.at(-1)?.content ? m.slice(0, -2) : m));
      setError((e as Error).message);
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  }

  return (
    <div className="et-ai">
      <div className="et-ai-head">
        <span className="et-ai-badge">
          <Sparkles size={15} />
        </span>
        <div className="et-ai-title">
          <b>Study assistant</b>
          <small>Ask anything about this lesson. Answers can be wrong, so check anything important.</small>
        </div>
        <span className={`et-ai-count${remaining <= 0 ? " is-out" : ""}`}>{remaining > 0 ? `${remaining} left today` : "Limit reached"}</span>
      </div>

      <div className="et-ai-log" aria-live="polite">
        {messages.length ? (
          messages.map((m, i) => (
            <div key={i} className={`et-ai-row is-${m.role}`}>
              {m.role === "assistant" && (
                <span className="et-ai-avatar" aria-hidden>
                  <Sparkles size={13} />
                </span>
              )}
              <div className={`et-ai-msg is-${m.role}`}>
                {m.role === "assistant" ? m.content ? <Formatted text={m.content} /> : <span className="et-ai-dots" aria-label="Thinking"><i /><i /><i /></span> : <p>{m.content}</p>}
              </div>
            </div>
          ))
        ) : (
          <div className="et-ai-empty">
            <span className="et-ai-badge">
              <Sparkles size={18} />
            </span>
            <b>Stuck on &ldquo;{lessonTitle}&rdquo;?</b>
            <p>Type a question below: ask for a summary, an explanation in simpler words, an example, or a quick quiz.</p>
          </div>
        )}
        <div ref={end} />
      </div>

      {error && <p className="et-ai-error">{error}</p>}

      <form
        className="et-ai-form"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <textarea
          ref={box}
          rows={1}
          value={input}
          maxLength={1500}
          placeholder={remaining > 0 ? "Ask a question about this lesson…" : "You've used today's questions. Back tomorrow."}
          disabled={remaining <= 0}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
        />
        <button type="submit" className="et-ai-send" disabled={busy || !input.trim() || remaining <= 0} aria-label="Send">
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
