"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { BookOpenCheck, Lightbulb, ListChecks, Send, Sparkles } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const QUICK = [
  { mode: "summary", label: "Summarise this lesson", icon: ListChecks },
  { mode: "quiz", label: "Quiz me", icon: BookOpenCheck },
  { mode: "simple", label: "Explain simply", icon: Lightbulb },
] as const;

// Inline **bold** and `code`, as React nodes (never raw HTML).
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : <Fragment key={i}>{part}</Fragment>,
  );
}

// The small slice of markdown the assistant uses: paragraphs, headings, bullet and numbered lists.
function Formatted({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)/);
    const numbered = line.match(/^\d+[.)]\s+(.*)/);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (!line) continue;
    const heading = line.match(/^#{1,4}\s+(.*)/);
    blocks.push(heading ? <h4 key={blocks.length}>{inline(heading[1])}</h4> : <p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

// Study assistant tab in the course player. Answers come from the course outline and this lesson's notes.
export function AskAi({ courseId, lessonId, lessonTitle, initial, remaining: startRemaining }: { courseId: string; lessonId: string; lessonTitle: string; initial: Message[]; remaining: number }) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(startRemaining);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function ask(mode: string, message = "") {
    if (busy || (mode === "chat" && !message.trim())) return;
    const label = mode === "chat" ? message.trim() : QUICK.find((q) => q.mode === mode)!.label;
    setError("");
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: label }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/ai/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId, mode, message }),
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
    }
  }

  return (
    <div className="et-ai">
      <div className="et-ai-head">
        <span className="et-ai-badge">
          <Sparkles size={14} />
        </span>
        <div>
          <b>Study assistant</b>
          <small>Ask anything about &ldquo;{lessonTitle}&rdquo;. Answers use this course&apos;s lessons, and can be wrong, so check anything important.</small>
        </div>
      </div>

      <div className="et-ai-quick">
        {QUICK.map(({ mode, label, icon: Icon }) => (
          <button key={mode} type="button" disabled={busy || remaining <= 0} onClick={() => ask(mode)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {messages.length > 0 && (
        <div className="et-ai-log" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`et-ai-msg is-${m.role}`}>
              {m.role === "assistant" ? m.content ? <Formatted text={m.content} /> : <span className="et-ai-dots" aria-label="Thinking"><i /><i /><i /></span> : <p>{m.content}</p>}
            </div>
          ))}
          <div ref={end} />
        </div>
      )}

      {error && <p className="et-ai-error">{error}</p>}

      <form
        className="et-ai-form"
        onSubmit={(e) => {
          e.preventDefault();
          ask("chat", input);
        }}
      >
        <textarea
          className="et-input"
          rows={2}
          value={input}
          maxLength={1500}
          placeholder={remaining > 0 ? "Ask a question about this lesson…" : "You've used today's questions. Back tomorrow."}
          disabled={busy || remaining <= 0}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask("chat", input);
            }
          }}
        />
        <button type="submit" className="et-btn et-btn-primary" disabled={busy || !input.trim() || remaining <= 0} aria-label="Send">
          <Send size={15} />
        </button>
      </form>
      <small className="et-ai-left">{remaining > 0 ? `${remaining} questions left today` : "Daily limit reached"}</small>
    </div>
  );
}
