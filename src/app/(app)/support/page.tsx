import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { PageHead, Status } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { startThread } from "./actions";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: threads } = await supabase
    .from("support_threads")
    .select("id, subject, status, user_unread, last_message_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false });
  // Only one conversation at a time; while it's unresolved, new questions go there.
  const active = (threads ?? []).find(
    (t) => t.status === "open" || t.status === "pending",
  );

  return (
    <div className="et-page">
      <PageHead
        title="Support"
        sub="Questions about a course, payments, or your account? Message the Etivio team."
      />
      <div
        className="et-grid-main"
        style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}
      >
        <section className="et-card">
          <div className="et-card-head">
            <h2>Your conversations</h2>
          </div>
          {threads?.length ? (
            <ul className="et-feed">
              {threads.map((t) => (
                <li key={t.id}>
                  {t.user_unread && (
                    <span className="et-feed-dot" aria-label="New reply" />
                  )}
                  <Link href={`/support/${t.id}`}>
                    <b>{t.subject}</b>
                  </Link>
                  <Status
                    value={t.status === "pending" ? "replied" : t.status}
                  />
                  <time>{formatDateTime(t.last_message_at)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="et-empty">No conversations yet.</p>
          )}
        </section>
        {active ? (
          <section className="et-card et-card-pad et-sup-active">
            <span className="et-sup-active-icon">
              <MessageCircle size={20} />
            </span>
            <h2>
              {active.status === "pending"
                ? "We replied to you"
                : "We're on it"}
            </h2>
            <p>
              {active.status === "pending"
                ? "The Etivio team answered your question. Reply there, or add anything else you need help with."
                : "Your question is with the Etivio team. Add more details or a new question to the same conversation, so everything stays in one place."}
            </p>
            <Link
              href={`/support/${active.id}`}
              className="et-btn et-btn-primary"
            >
              Open &ldquo;{active.subject}&rdquo;
            </Link>
            <small>
              You can start a new conversation once this one is resolved.
            </small>
          </section>
        ) : (
          <section className="et-card">
            <div className="et-card-head">
              <h2>New message</h2>
            </div>
            <div className="et-card-pad">
              <ActionForm action={startThread}>
                <div className="et-field">
                  <label htmlFor="subject">Subject</label>
                  <input
                    id="subject"
                    name="subject"
                    required
                    maxLength={140}
                    placeholder="e.g. Can't access my course"
                  />
                </div>
                <div className="et-field">
                  <label htmlFor="body">Message</label>
                  <textarea
                    id="body"
                    name="body"
                    rows={6}
                    required
                    maxLength={5000}
                  />
                </div>
                <div className="et-form-foot">
                  <SubmitButton pendingLabel="Sending…">
                    Send to support
                  </SubmitButton>
                </div>
              </ActionForm>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
