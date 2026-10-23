"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";
import { startConversation, type StartState } from "@/app/(app)/messages/actions";

// "Message the tutor" for enrolled students: opens their existing conversation, or a box to send the first message.
export function MessageTutor({ courseId, tutorName, conversationId, compact }: { courseId: string; tutorName: string; conversationId: string | null; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<StartState, FormData>(startConversation, null);
  if (conversationId)
    return (
      <Link href={`/learn/messages/${conversationId}`} className={`et-btn et-btn-ghost${compact ? " et-ud-cta et-ud-outline" : ""}`}>
        <MessageCircle size={16} /> Open your chat with {tutorName}
      </Link>
    );
  if (!open)
    return (
      <button type="button" className={`et-btn et-btn-ghost${compact ? " et-ud-cta et-ud-outline" : ""}`} onClick={() => setOpen(true)}>
        <MessageCircle size={16} /> Message {tutorName}
      </button>
    );
  return (
    <form action={action} className="et-mt-form">
      <input type="hidden" name="course_id" value={courseId} />
      <label htmlFor={`mt-${courseId}`}>Message {tutorName}</label>
      <textarea id={`mt-${courseId}`} name="body" rows={4} maxLength={5000} autoFocus placeholder="Ask a question about the course…" />
      {state?.error && <p className="et-gb-error">{state.error}</p>}
      <div className="et-inline">
        <button type="submit" className="et-btn et-btn-primary et-btn-sm" disabled={pending}>
          <Send size={14} /> {pending ? "Sending…" : "Send"}
        </button>
        <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
