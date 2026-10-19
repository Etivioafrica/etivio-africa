"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Award, BadgeCheck, ExternalLink, RotateCcw, Search, ShieldX, X } from "lucide-react";
import { StatStrip } from "@/components/dash/ui";
import { useToast } from "@/components/dash/useToast";
import { fmtShort } from "@/lib/blog";
import { restoreCertificate, revokeCertificate } from "../actions";

type Cert = {
  code: string;
  user_id: string;
  course_id: string | null;
  recipient_name: string;
  course_title: string;
  instructor_name: string | null;
  issued_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
};

const withinDays = (iso: string, days: number) => Date.parse(iso) > Date.now() - days * 86_400_000;

export function CertificatesClient({ certs }: { certs: Cert[] }) {
  const [toast, show] = useToast();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"all" | "valid" | "revoked">("all");
  const [target, setTarget] = useState<Cert | null>(null);
  const [reason, setReason] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const q = search.trim().toLowerCase();
  const revoked = certs.filter((c) => c.revoked_at).length;
  const month = certs.filter((c) => withinDays(c.issued_at, 30)).length;
  const shown = certs.filter(
    (c) =>
      (state === "all" || (state === "revoked") === !!c.revoked_at) &&
      (!q || c.code.toLowerCase().includes(q) || c.recipient_name.toLowerCase().includes(q) || c.course_title.toLowerCase().includes(q)),
  );

  return (
    <>
      {toast}
      <StatStrip
        items={[
          { label: "Issued", value: certs.length, icon: Award },
          { label: "Last 30 days", value: month, icon: BadgeCheck },
          { label: "Revoked", value: revoked, icon: ShieldX },
        ]}
      />
      <section className="et-card">
        <div className="et-blog-bar">
          <nav className="et-blog-filter" aria-label="Filter certificates">
            {(["all", "valid", "revoked"] as const).map((s) => (
              <button key={s} type="button" className={state === s ? "is-on" : ""} onClick={() => setState(s)} aria-pressed={state === s}>
                {s === "all" ? "All" : s === "valid" ? "Valid" : "Revoked"}
                <span>{s === "all" ? certs.length : s === "valid" ? certs.length - revoked : revoked}</span>
              </button>
            ))}
          </nav>
          <label className="et-blog-search">
            <Search size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, course or code…" aria-label="Search certificates" />
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="et-empty">{certs.length ? "No certificates match." : "No certificates issued yet. They're created automatically when a learner finishes a course."}</p>
        ) : (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Course</th>
                  <th>Code</th>
                  <th>Issued</th>
                  <th>Status</th>
                  <th className="et-td-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.code}>
                    <td>
                      <Link href={`/admin/users/${c.user_id}`}>
                        <b>{c.recipient_name}</b>
                      </Link>
                    </td>
                    <td>
                      {c.course_id ? <Link href={`/admin/courses/${c.course_id}`}>{c.course_title}</Link> : c.course_title}
                      {c.instructor_name && <small className="et-muted" style={{ display: "block" }}>{c.instructor_name}</small>}
                    </td>
                    <td>
                      <code className="et-code">{c.code}</code>
                    </td>
                    <td className="et-nowrap">{fmtShort(c.issued_at)}</td>
                    <td>
                      {c.revoked_at ? (
                        <span className="et-blog-status is-static is-draft" title={c.revoked_reason ?? ""}>
                          <i /> Revoked
                        </span>
                      ) : (
                        <span className="et-blog-status is-static is-published">
                          <i /> Valid
                        </span>
                      )}
                    </td>
                    <td className="et-td-right">
                      <span className="et-row-actions">
                        <Link href={`/certificate/${c.code}`} target="_blank" data-tip="Open verify page" aria-label="Open verify page">
                          <ExternalLink size={14} />
                        </Link>
                        {c.revoked_at ? (
                          <button type="button" disabled={pending} onClick={() => start(async () => show(await restoreCertificate(c.code)))} data-tip="Restore" aria-label="Restore">
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="is-danger"
                            onClick={() => {
                              setTarget(c);
                              setReason("");
                              dialog.current?.showModal();
                            }}
                            data-tip="Revoke"
                            aria-label="Revoke"
                          >
                            <ShieldX size={14} />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <dialog ref={dialog} className="et-modal et-modal-sm" aria-label="Revoke certificate" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="et-modal-head">
          <div>
            <h2>Revoke certificate</h2>
            <p>
              {target?.recipient_name} · {target?.course_title} · {target?.code}
            </p>
          </div>
          <button type="button" className="et-icon-btn" onClick={() => dialog.current?.close()} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="et-modal-body">
          <div className="et-field">
            <label htmlFor="why">Reason</label>
            <textarea id="why" className="et-input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Issued in error. Course completed by someone else." />
            <small>Anyone checking this certificate will see it was revoked, and this reason.</small>
          </div>
        </div>
        <div className="et-modal-foot">
          <button type="button" className="et-btn et-btn-ghost" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button
            type="button"
            className="et-btn et-btn-danger"
            disabled={pending || !reason.trim()}
            onClick={() =>
              target &&
              start(async () => {
                const res = await revokeCertificate(target.code, reason);
                show(res);
                if (!res.error) dialog.current?.close();
              })
            }
          >
            {pending ? "Revoking…" : "Revoke"}
          </button>
        </div>
      </dialog>
    </>
  );
}
