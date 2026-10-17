import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { PageHead, Status } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { reviewApplication } from "../actions";

export const metadata = { title: "Applications" };

export default async function Applications({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { db } = await requireAdmin("users");
  const { status } = await searchParams;
  const filter = status === "approved" || status === "rejected" ? status : "pending";

  const { data: apps } = await db
    .from("role_applications")
    .select("id, role, status, message, review_note, created_at, reviewed_at, user:profiles!role_applications_user_id_fkey(id, full_name, avatar_url)")
    .eq("status", filter)
    .order("created_at", { ascending: filter === "pending" })
    .limit(100);

  return (
    <div className="et-page">
      <Link href="/admin/users" className="et-back">
        <ArrowLeft size={14} />
        Users
      </Link>
      <PageHead title="Role applications" sub="People asking to become tutors, coaches, event managers, or community owners.">
        <div className="et-tabs">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <Link key={s} href={s === "pending" ? "/admin/users/applications" : `/admin/users/applications?status=${s}`} className={s === filter ? "is-on" : ""} style={{ textTransform: "capitalize" }}>
              {s}
            </Link>
          ))}
        </div>
      </PageHead>

      {apps?.length ? (
        apps.map((a) => (
          <section key={a.id} className="et-card">
            <div className="et-card-head">
              <Link href={`/admin/users/${a.user?.id}`} className="et-cell-main">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.user?.avatar_url ? <img src={a.user.avatar_url} alt="" className="et-avatar" /> : <span className="et-avatar">{(a.user?.full_name || "?").charAt(0).toUpperCase()}</span>}
                <span>
                  <b style={{ fontSize: 14 }}>{a.user?.full_name || "Unnamed"}</b>
                  <small className="et-muted" style={{ display: "block", fontSize: 12 }}>
                    wants to be a <b>{ROLE_LABELS[a.role].toLowerCase()}</b> · applied {formatDate(a.created_at)}
                  </small>
                </span>
              </Link>
              <Status value={a.status} />
            </div>
            <div className="et-card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p className="et-prose" style={{ fontSize: 13.5 }}>
                {a.message || "No message."}
              </p>
              {a.status === "pending" ? (
                <form action={reviewApplication} className="et-inline">
                  <input type="hidden" name="id" value={a.id} />
                  <input name="note" className="et-input" placeholder="Note to the applicant (optional)" aria-label="Review note" style={{ flex: 1, height: 36 }} />
                  <button type="submit" name="decision" value="approve" className="et-btn et-btn-success et-btn-sm">
                    <Check size={14} />
                    Approve
                  </button>
                  <button type="submit" name="decision" value="reject" className="et-btn et-btn-ghost et-btn-sm">
                    <X size={14} />
                    Reject
                  </button>
                </form>
              ) : (
                a.review_note && <p className="et-muted" style={{ fontSize: 12.5 }}>Note: {a.review_note}</p>
              )}
            </div>
          </section>
        ))
      ) : (
        <section className="et-card">
          <p className="et-empty">No {filter} applications.</p>
        </section>
      )}
    </div>
  );
}
