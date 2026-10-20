import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHead, Status } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { formatDateTime, formatMoney, formatPrice } from "@/lib/format";
import type { Database } from "@/lib/database.types";
import { recordPayment, refundPayment } from "../actions";
import { Select } from "@/components/dash/Select";

export const metadata = { title: "Payments" };

type PayStatus = Database["public"]["Enums"]["payment_status"];
const TABS: PayStatus[] = ["success", "pending", "failed", "refunded"];

export default async function Payments({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { db } = await requireAdmin("financials");
  const sp = await searchParams;
  const status = TABS.find((t) => t === sp.status);
  const q = sp.q?.trim() ?? "";

  let query = db
    .from("payments")
    .select("id, amount_minor, currency, platform_fee_minor, instructor_share_minor, status, provider, reference, note, paid_at, created_at, user_id, buyer:profiles!payments_user_id_fkey(full_name), course:courses(title), product:products(title)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("reference", `%${q}%`);
  const [{ data: payments }, { data: courses }] = await Promise.all([
    query,
    db.from("courses").select("id, title, price_minor, currency").neq("status", "archived").order("title"),
  ]);

  return (
    <div className="et-page">
      <Link href="/admin/financials" className="et-back">
        <ArrowLeft size={14} />
        Financials
      </Link>
      <PageHead title="Payments" sub="Every course and product purchase. Paystack payments land here automatically." />

      <div className="et-grid-main" style={{ gridTemplateColumns: "minmax(0,1fr) 360px" }}>
        <section className="et-card">
          <div className="et-filters">
            <div className="et-tabs">
              <Link href="/admin/financials/payments" className={!status ? "is-on" : ""}>
                All
              </Link>
              {TABS.map((t) => (
                <Link key={t} href={`/admin/financials/payments?status=${t}`} className={t === status ? "is-on" : ""} style={{ textTransform: "capitalize" }}>
                  {t}
                </Link>
              ))}
            </div>
            <form action="/admin/financials/payments" style={{ marginLeft: "auto" }}>
              {status && <input type="hidden" name="status" value={status} />}
              <input name="q" defaultValue={q} className="et-input" placeholder="Search reference" aria-label="Search by reference" />
            </form>
          </div>
          {payments?.length ? (
            <div className="et-table-wrap">
              <table className="et-table">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th className="et-th-right">Amount</th>
                    <th className="et-th-right">Platform</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.user_id ? (
                          <Link href={`/admin/users/${p.user_id}`}>
                            <b>{p.buyer?.full_name || "Unnamed"}</b>
                          </Link>
                        ) : (
                          <b>Deleted user</b>
                        )}
                        <small>
                          {p.course?.title ?? p.product?.title ?? "Sale"} · {p.provider} · {p.reference}
                        </small>
                      </td>
                      <td className="et-td-right et-money">{formatMoney(p.amount_minor, p.currency)}</td>
                      <td className="et-td-right">{formatMoney(p.platform_fee_minor, p.currency)}</td>
                      <td>
                        <Status value={p.status} />
                      </td>
                      <td>{formatDateTime(p.paid_at ?? p.created_at)}</td>
                      <td className="et-td-right">
                        {p.status === "success" && (
                          <form action={refundPayment} className="et-inline" style={{ justifyContent: "flex-end" }}>
                            <input type="hidden" name="id" value={p.id} />
                            <label className="et-check" data-tip="Also remove their course access">
                              <input type="checkbox" name="revoke" />
                              Revoke
                            </label>
                            <button type="submit" className="et-btn et-btn-sm et-btn-danger-text">
                              Refund
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="et-empty">No payments match.</p>
          )}
        </section>

        <section className="et-card">
          <div className="et-card-head">
            <h2>Record a payment</h2>
          </div>
          <div className="et-card-pad">
            <ActionForm action={recordPayment}>
              <p className="et-muted" style={{ fontSize: 12.5 }}>
                For bank transfers and other offline sales. The buyer is enrolled straight away.
              </p>
              <div className="et-field">
                <label htmlFor="email">Buyer email</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div className="et-field">
                <label htmlFor="course_id">Course</label>
                <Select id="course_id" name="course_id" required defaultValue="">
                  <option value="" disabled>
                    Pick a course
                  </option>
                  {(courses ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} · {formatPrice(c.price_minor, c.currency)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="et-form-grid">
                <div className="et-field">
                  <label htmlFor="amount">Amount (₦)</label>
                  <input id="amount" name="amount" inputMode="decimal" placeholder="Course price" />
                </div>
                <div className="et-field">
                  <label htmlFor="reference">Reference</label>
                  <input id="reference" name="reference" placeholder="Auto" />
                </div>
              </div>
              <div className="et-field">
                <label htmlFor="note">Note</label>
                <input id="note" name="note" placeholder="Optional" />
              </div>
              <div className="et-form-foot">
                <SubmitButton pendingLabel="Recording…">Record payment</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </section>
      </div>
    </div>
  );
}
