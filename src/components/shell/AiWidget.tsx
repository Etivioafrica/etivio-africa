"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, History, MessageCircle, Send, SquarePen } from "lucide-react";
import { AiAvatar } from "@/components/learn/AiAvatar";
import { Formatted } from "@/components/learn/Formatted";

type Message = { role: "user" | "assistant"; content: string };
type Recent = { id: number; question: string; at: string; where: string; href: string | null };
type Tab = "ask" | "recent";

const SINCE_KEY = "et-ai-since";
const readSince = () => {
  try {
    return localStorage.getItem(SINCE_KEY);
  } catch {
    return null;
  }
};
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase();

// Floating Etivio AI button and panel for the app: a chat that knows your courses and the app, plus your recent
// questions from here and from lessons.
export function AiWidget({ name }: { name: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("ask");
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const first = name.split(/[\s@]/)[0];

  async function load() {
    const since = readSince();
    const res = await fetch(`/api/ai/assistant${since ? `?since=${encodeURIComponent(since)}` : ""}`).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    if (data) {
      setAvailable(data.available);
      setRemaining(data.remaining);
      setMessages(data.messages);
      setRecent(data.recent);
    }
    setLoaded(true);
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => box.current?.focus(), 50);
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", h);
    };
  }, [open]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, tab]);

  function newChat() {
    try {
      localStorage.setItem(SINCE_KEY, new Date().toISOString());
    } catch {}
    setMessages([]);
    setError("");
    setTab("ask");
    box.current?.focus();
  }

  async function ask(message: string) {
    const question = message.trim();
    if (busy || !question) return;
    setError("");
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, since: readSince(), page: pathname }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Etivio AI couldn't answer just now.");
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
      if (!text.trim()) throw new Error("Etivio AI didn't reply. Try asking again.");
      setRecent((r) => [{ id: -Date.now(), question, at: new Date().toISOString(), where: "Etivio AI", href: null }, ...r].slice(0, 12));
    } catch (e) {
      setMessages((m) => (m.at(-1)?.role === "assistant" && !m.at(-1)?.content ? m.slice(0, -2) : m));
      setError((e as Error).message);
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  }

  const out = remaining !== null && remaining <= 0;

  return (
    <div className="et-aw">
      {open && (
        <section className="et-aw-panel" role="dialog" aria-label="Etivio AI">
          <header className="et-aw-head">
            <AiAvatar size={34} busy={busy} />
            <div>
              <b>Etivio AI</b>
              <small>{remaining === null ? "Your learning assistant" : out ? "Today's questions used" : `${remaining} questions left today`}</small>
            </div>
            {tab === "ask" && messages.length > 0 && (
              <button type="button" className="et-aw-icon" onClick={newChat} aria-label="New chat" title="New chat">
                <SquarePen size={16} />
              </button>
            )}
          </header>

          {tab === "ask" ? (
            <>
              <div className="et-aw-body" aria-live="polite">
                {!loaded ? (
                  <div className="et-aw-dots-wrap">
                    <span className="et-ai-dots" aria-label="Loading">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                ) : messages.length ? (
                  messages.map((m, i) => (
                    <div key={i} className={`et-aw-msg is-${m.role}`}>
                      {m.role === "assistant" ? (
                        m.content ? (
                          <Formatted text={m.content} />
                        ) : (
                          <span className="et-ai-dots" aria-label="Thinking">
                            <i />
                            <i />
                            <i />
                          </span>
                        )
                      ) : (
                        <p>{m.content}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="et-aw-hello">
                    <AiAvatar size={56} />
                    <span className="et-aw-date">
                      {dateLabel(new Date().toISOString())} <em>• AI</em>
                    </span>
                    <b>Hi {first}, how can I help?</b>
                    <p>Ask me to explain a topic, suggest a course for you, plan your week of study, or find something in the app.</p>
                  </div>
                )}
                <div ref={end} />
              </div>
              {error && <p className="et-aw-error">{error}</p>}
              <form
                className="et-aw-form"
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
                  disabled={out || !available}
                  placeholder={!available ? "Etivio AI isn't available right now." : out ? "You've used today's questions. Back tomorrow." : "Ask Etivio AI…"}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask(input);
                    }
                  }}
                />
                <button type="submit" className="et-aw-send" disabled={busy || !input.trim() || out || !available} aria-label="Send">
                  <Send size={15} />
                </button>
              </form>
            </>
          ) : (
            <div className="et-aw-body">
              {recent.length ? (
                <ol className="et-aw-timeline">
                  {recent.map((r) => {
                    const inner = (
                      <>
                        <span className="et-aw-date">
                          {dateLabel(r.at)} <em>• {r.where}</em>
                        </span>
                        <p>{r.question}</p>
                      </>
                    );
                    return (
                      <li key={r.id}>
                        {r.href ? (
                          <Link href={r.href} onClick={() => setOpen(false)}>
                            {inner}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setInput(r.question);
                              setTab("ask");
                              setTimeout(() => box.current?.focus(), 0);
                            }}
                          >
                            {inner}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="et-aw-hello">
                  <b>No questions yet</b>
                  <p>Questions you ask here and in your lessons show up in this list.</p>
                </div>
              )}
            </div>
          )}

          <nav className="et-aw-tabs" aria-label="Etivio AI">
            <button type="button" className={tab === "ask" ? "is-on" : ""} onClick={() => setTab("ask")}>
              <MessageCircle size={19} />
              Ask
            </button>
            <button type="button" className={tab === "recent" ? "is-on" : ""} onClick={() => setTab("recent")}>
              <History size={19} />
              Recent
            </button>
          </nav>
          <footer className="et-aw-foot">
            Powered by <b>Etivio AI</b>
          </footer>
        </section>
      )}
      <button type="button" className={`et-aw-launch${open ? " is-open" : ""}`} onClick={() => {
          if (!open && !loaded) load();
          setOpen(!open);
        }} aria-label={open ? "Close Etivio AI" : "Open Etivio AI"} aria-expanded={open}>
        {open ? <ChevronDown size={20} /> : <AiAvatar size={56} />}
      </button>
    </div>
  );
}
