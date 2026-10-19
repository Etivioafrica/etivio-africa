import { Suspense } from "react";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { TEMPLATES } from "@/lib/email/registry";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Email templates" };

export default function EmailTemplates() {
  return (
    <div className="et-page">
      <p className="et-set-crumb">
        <Link href="/admin/emails">Emails</Link> <span>/</span> Templates
      </p>
      <div className="et-page-head">
        <div>
          <h1>Email templates</h1>
          <p>Open any email to change its design in the drag-and-drop editor. Emails you haven&apos;t customised use the built-in design.</p>
        </div>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const { db } = await requireAdmin("emails");
  const { data: saved } = await db.from("email_templates").select("key, subject, updated_at");
  const byKey = new Map((saved ?? []).map((s) => [s.key, s]));

  return (["app", "auth"] as const).map((g) => (
    <section key={g} className="et-card">
      <div className="et-card-head">
        <h2>{g === "app" ? "Sent by the app" : "Sign-in and account"}</h2>
        <span className="et-muted" style={{ fontSize: 12.5 }}>
          {g === "app" ? "Welcome, courses, support and announcements" : "Sent by Supabase"}
        </span>
      </div>
      <div className="et-table-wrap">
        <table className="et-table et-tpl-list">
          <thead>
            <tr>
              <th>Email</th>
              <th>Subject</th>
              <th>Design</th>
              <th>Last edited</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {TEMPLATES.filter((t) => t.group === g).map((t) => {
              const s = byKey.get(t.key);
              return (
                <tr key={t.key}>
                  <td>
                    <Link href={`/admin/emails/templates/${t.key}`} className="et-tpl-name">
                      {t.label}
                    </Link>
                    <small>{t.when}</small>
                  </td>
                  <td className="et-tpl-subject">{s?.subject ?? t.subject}</td>
                  <td>
                    <span className={`et-tag${s ? "" : " is-muted"}`}>{s ? "Customised" : "Built-in"}</span>
                  </td>
                  <td className="et-muted" style={{ whiteSpace: "nowrap" }}>
                    {s ? formatDateTime(s.updated_at) : "Never"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/admin/emails/templates/${t.key}`} className="et-btn et-btn-ghost et-btn-sm">
                      <PenLine size={13} /> Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  ));
}
