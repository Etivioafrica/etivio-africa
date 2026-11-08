import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, EyeOff } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { adminConversation } from "@/lib/data/messages";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Course messages" };

type Props = { params: Promise<{ id: string }> };

export default function AdminConversation({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <View params={params} />
      </Suspense>
    </div>
  );
}

async function View({ params }: Props) {
  await requireAdmin("chats");
  const { id } = await params;
  const c = await adminConversation(id);
  if (!c) notFound();
  return (
    <>
      <Link href="/admin/course-messages" className="et-back">
        <ArrowLeft size={14} />
        Course messages
      </Link>
      <section className="et-card">
        <div className="et-card-head">
          <div>
            <h2>
              <Link href={`/admin/users/${c.studentId}`}>{c.studentName}</Link> and <Link href={`/admin/users/${c.tutorId}`}>{c.tutorName}</Link>
            </h2>
            <small className="et-muted">
              <Link href={`/admin/courses/${c.courseId}`}>{c.courseTitle}</Link> · read-only
            </small>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 20px 20px" }}>
          {c.messages.length === 0 && <p className="et-muted">No messages in this conversation.</p>}
          {c.messages.map((m) => {
            const tutor = m.sender_id === c.tutorId;
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: tutor ? "flex-end" : "flex-start",
                  maxWidth: "75%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--a-border)",
                  background: tutor ? "var(--accent)" : "var(--a-panel-2)",
                  color: tutor ? "#fff" : "var(--a-fg)",
                  opacity: m.hidden ? 0.6 : 1,
                }}
              >
                <small style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 11.5, opacity: 0.8 }}>
                  {tutor ? c.tutorName : c.studentName} · {formatDateTime(m.created_at)}
                  {m.hidden && (
                    <>
                      <EyeOff size={12} /> held by moderation
                    </>
                  )}
                </small>
                <span style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{m.body}</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
