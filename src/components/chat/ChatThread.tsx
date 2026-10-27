"use client";
import { useEffect, useRef, useState } from "react";
import { listen } from "@/lib/supabase/realtime";
import { Send } from "lucide-react";
import { ReportButton } from "@/components/moderation/ReportButton";

export type ChatMessage = { id: string; body: string; is_staff?: boolean; sender_id?: string | null; created_at: string; sender?: string; hidden?: boolean };
export type SendResult = { error?: string; message?: ChatMessage };

const time = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Live conversation. New messages arrive over Supabase Realtime; RLS decides who can see them.
// Support threads by default; pass `course` for a student-tutor conversation (messages are "mine" by sender).
export function ChatThread({
  threadId,
  initial,
  viewer,
  send,
  closed,
  course,
}: {
  threadId: string;
  initial: ChatMessage[];
  viewer: "staff" | "user";
  send: (fd: FormData) => Promise<SendResult>;
  closed?: boolean;
  course?: { viewerId: string; otherName: string };
}) {
  const [messages, setMessages] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);

  const isCourse = !!course;
  const add = (m: ChatMessage) => setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));

  useEffect(
    () =>
      listen((supabase) =>
        supabase
          .channel(`${isCourse ? "conversation" : "support"}:${threadId}`)
      .on(
        "postgres_changes",
        isCourse
          ? { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${threadId}` }
          : { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
            (payload) => add(payload.new as ChatMessage),
          )
          .subscribe(),
      ),
    [threadId, isCourse],
  );

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("body") ?? "").trim()) return;
    setPending(true);
    setError(null);
    const res = await send(fd);
    setPending(false);
    if (res.error) return setError(res.error);
    if (res.message) add(res.message);
    form.current?.reset();
  }

  return (
    <>
      <div className="et-chat-msgs">
        {messages.length ? (
          messages.map((m) => {
            const mine = course ? m.sender_id === course.viewerId : viewer === "staff" ? m.is_staff : !m.is_staff;
            const who = course ? (mine ? "You" : course.otherName) : m.is_staff ? (viewer === "staff" ? (m.sender ?? "Staff") : "Etivio support") : viewer === "staff" ? (m.sender ?? "User") : "You";
            return (
              <div key={m.id} className={`et-msg${mine ? " is-mine" : ""}`}>
                <p>{m.body}</p>
                <small>
                  {who} · {time(m.created_at)}
                  {m.hidden ? " · Waiting for a check" : ""}
                  {course && !mine && <ReportButton type="message" id={m.id} small />}
                </small>
              </div>
            );
          })
        ) : (
          <div className="et-chat-empty">No messages yet.</div>
        )}
        <div ref={bottom} />
      </div>
      {closed && viewer === "user" ? (
        <div className="et-chat-compose et-muted" style={{ fontSize: 13 }}>
          This conversation is closed. Start a new one if you need more help.
        </div>
      ) : (
        <form ref={form} onSubmit={onSubmit} className="et-chat-compose">
          <input type="hidden" name="thread_id" value={threadId} />
          <textarea
            name="body"
            rows={1}
            maxLength={5000}
            placeholder={course ? `Message ${course.otherName}…` : viewer === "staff" ? "Reply to this user…" : "Write a message…"}
            aria-label="Message"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" className="et-btn et-btn-primary" disabled={pending} aria-label="Send">
            <Send size={15} />
          </button>
        </form>
      )}
      {error && <p className="et-flash et-flash-err" style={{ margin: "0 20px 14px" }}>{error}</p>}
    </>
  );
}
