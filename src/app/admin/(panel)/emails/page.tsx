import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { emailConfigured, emailFrom } from "@/lib/email/send";
import { formatDateTime } from "@/lib/format";
import { PageHead } from "@/components/dash/ui";
import { sendTestEmail } from "./actions";

export const metadata = { title: "Emails" };

const KINDS: Record<string, string> = {
  welcome: "Welcome",
  enrolled: "Enrolled",
  certificate: "Certificate",
  support_reply: "Support reply",
  review_reply: "Review reply",
  application_approved: "Application approved",
  application_rejected: "Application declined",
  announcement: "Announcement",
  test: "Test",
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export default function EmailsPage() {
  return (
    <div className="et-page">
      <PageHead title="Emails" sub="What Etivio sends to learners, and whether it got there." />
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Emails />
      </Suspense>
    </div>
  );
}

async function Emails() {
  const { admin, db } = await requireAdmin("emails");
  const since = daysAgo(30);
  const [{ data: rows }, { count: sent }, { count: failed }] = await Promise.all([
    db.from("email_log").select("id, to_email, kind, subject, status, error, created_at").order("created_at", { ascending: false }).limit(60),
    db.from("email_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", since),
    db.from("email_log").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since),
  ]);
  const ready = emailConfigured();

  return (
    <>
      <section className="et-card">
        <div className="et-card-head">
          <h2>Sending</h2>
          <span className={`et-tag${ready ? "" : " is-warn"}`}>{ready ? "Connected to Resend" : "Not set up"}</span>
        </div>
        <dl className="et-kv et-card-pad">
          <dt>From</dt>
          <dd>{emailFrom()}</dd>
          <dt>Last 30 days</dt>
          <dd>
            {sent ?? 0} sent · {failed ?? 0} failed
          </dd>
          <dt>Sends automatically</dt>
          <dd>Welcome, enrolment, certificates, support replies, review replies, tutor application decisions and announcements. Learners can turn off support replies and course updates in their settings.</dd>
        </dl>
        {!ready && (
          <p className="et-flash et-flash-warn" style={{ margin: "0 20px 20px" }}>
            Add RESEND_API_KEY and EMAIL_FROM in Vercel, then redeploy. Until then emails are logged below as skipped.
          </p>
        )}
        <ActionForm action={sendTestEmail} toast className="et-card-pad">
          <SubmitButton pendingLabel="Sending…">Send a test email to {admin.email}</SubmitButton>
        </ActionForm>
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Recent emails</h2>
          <span className="et-muted" style={{ fontSize: 12.5 }}>
            Last 60 · kept for 6 months
          </span>
        </div>
        {rows?.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.created_at)}</td>
                    <td>{r.to_email}</td>
                    <td>{KINDS[r.kind] ?? r.kind}</td>
                    <td>{r.subject}</td>
                    <td title={r.error ?? undefined}>
                      <span className={`et-tag${r.status === "sent" ? "" : " is-warn"}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-card-pad et-muted">No emails yet.</p>
        )}
      </section>
    </>
  );
}
