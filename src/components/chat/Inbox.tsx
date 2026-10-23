import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { ChatThread } from "./ChatThread";
import { openConversation, type ConversationRow } from "@/lib/data/messages";
import { sendCourseMessage } from "@/app/(app)/messages/actions";
import { formatDateTime } from "@/lib/format";

// The list of student-tutor conversations, for Learn → Messages and Teach → Messages.
export function ConversationList({ rows, base, empty }: { rows: ConversationRow[]; base: string; empty: React.ReactNode }) {
  if (!rows.length)
    return (
      <div className="et-inbox-empty">
        <span className="et-cta-icon">
          <MessageCircle size={22} />
        </span>
        {empty}
      </div>
    );
  return (
    <ul className="et-inbox">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`${base}/${c.id}`} className={c.unread ? "is-unread" : undefined}>
            <Avatar src={c.otherAvatar} initial={c.otherName.charAt(0).toUpperCase()} seed={c.otherName} className="et-inbox-face" />
            <span className="et-inbox-text">
              <span className="et-inbox-top">
                <b>{c.otherName}</b>
                <small>{formatDateTime(c.lastAt)}</small>
              </span>
              <small className="et-inbox-course">{c.courseTitle}</small>
              <span className="et-inbox-last">{c.lastMessage ?? "No messages yet"}</span>
            </span>
            {c.unread > 0 && <span className="et-count">{c.unread}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// One conversation, live. `base` is where the back link goes.
export async function ConversationView({ id, userId, base }: { id: string; userId: string; base: string }) {
  const c = await openConversation(id, userId);
  if (!c) notFound();
  return (
    <>
      <Link href={base} className="et-back">
        <ArrowLeft size={14} />
        Messages
      </Link>
      <section className="et-card et-convo">
        <div className="et-chat-head">
          <h2>{c.otherName}</h2>
          <small className="et-muted">
            {c.side === "student" ? "Tutor of " : "Student in "}
            {c.courseSlug ? <Link href={c.side === "student" ? `/learn/course/${c.courseId}` : `/teach/courses/${c.courseId}`}>{c.courseTitle}</Link> : c.courseTitle}
          </small>
        </div>
        <ChatThread threadId={c.id} initial={c.messages} viewer="user" send={sendCourseMessage} course={{ viewerId: userId, otherName: c.otherName }} />
      </section>
    </>
  );
}
