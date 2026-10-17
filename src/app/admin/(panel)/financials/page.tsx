import Link from "next/link";
import { ArrowDownRight, Banknote, Building2, HandCoins, Wallet } from "lucide-react";
import { PageHead, Stat, Status } from "@/components/dash/ui";
import { BarChart } from "@/components/dash/BarChart";
import { requireAdmin } from "@/lib/admin";
import { monthLabel, profileNames } from "@/lib/data/admin";
import { compactMoney, formatDate, formatMoney } from "@/lib/format";
import { setPayoutStatus } from "./actions";
import { PayoutForm } from "./PayoutForm";

export const metadata = { title: "Financials" };

export default async function Financials() {
  const { db } = await requireAdmin("financials");
  const [{ data: monthly }, { data: balances }, { data: totals }, { data: payouts }, { data: recent }, { data: settings }] = await Promise.all([
    db.rpc("admin_monthly_revenue", { p_months: 12 }),
    db.rpc("admin_instructor_balances"),
    db.from("payments").select("amount_minor, platform_fee_minor, instructor_share_minor, status"),
    db.from("payouts").select("id, instructor_id, amount_minor, status, reference, created_at, paid_at").order("created_at", { ascending: false }).limit(20),
    db
      .from("payments")
      .select("id, amount_minor, currency, status, provider, reference, paid_at, created_at, buyer:profiles!payments_user_id_fkey(full_name), course:courses(title)")
      .order("created_at", { ascending: false })
      .limit(8),
    db.from("platform_settings").select("commission_percent").single(),
  ]);

  const ok = (totals ?? []).filter((p) => p.status === "success");
  const gross = ok.reduce((n, p) => n + p.amount_minor, 0);
  const platform = ok.reduce((n, p) => n + p.platform_fee_minor, 0);
  const instructorEarned = ok.reduce((n, p) => n + p.instructor_share_minor, 0);
  const refunded = (totals ?? []).filter((p) => p.status === "refunded").reduce((n, p) => n + p.amount_minor, 0);
  const owed = (balances ?? []).reduce((n, b) => n + Math.max(0, b.earned_minor - b.paid_minor), 0);
  const payoutNames = await profileNames(db, (payouts ?? []).map((p) => p.instructor_id));
  const months = monthly ?? [];
  const thisMonth = months.at(-1)?.gross_minor ?? 0;

  return (
    <div className="et-page">
      <PageHead title="Financials" sub={`Course sales, the platform's ${Number(settings?.commission_percent ?? 20)}% commission, and instructor payouts.`}>
        <Link href="/admin/financials/payments" className="et-btn et-btn-ghost">
          All payments
        </Link>
      </PageHead>

      <div className="et-stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        <Stat label="Gross revenue" value={compactMoney(gross)} icon={Wallet} />
        <Stat label="This month" value={compactMoney(thisMonth)} icon={Banknote} />
        <Stat label="Platform earnings" value={compactMoney(platform)} icon={Building2} />
        <Stat label="Owed to instructors" value={compactMoney(owed)} icon={HandCoins} />
        <Stat label="Refunded" value={compactMoney(refunded)} icon={ArrowDownRight} />
      </div>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Gross revenue by month</h2>
          <span className="et-muted" style={{ fontSize: 12.5 }}>
            Instructors earned {formatMoney(instructorEarned)} in total
          </span>
        </div>
        <BarChart
          data={months.map((m) => ({
            label: monthLabel(m.month),
            value: m.gross_minor,
            tip: `${monthLabel(m.month)}: ${formatMoney(m.gross_minor)} from ${m.sales} ${m.sales === 1 ? "sale" : "sales"} (platform ${formatMoney(m.platform_minor)})`,
          }))}
          format={compactMoney}
          height={200}
        />
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Instructor balances</h2>
        </div>
        {balances?.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Instructor</th>
                  <th className="et-th-right">Sales</th>
                  <th className="et-th-right">Earned</th>
                  <th className="et-th-right">Paid out</th>
                  <th className="et-th-right">Scheduled</th>
                  <th className="et-th-right">Owed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const due = b.earned_minor - b.paid_minor;
                  return (
                    <tr key={b.instructor_id}>
                      <td>
                        <Link href={`/admin/users/${b.instructor_id}`}>
                          <b>{b.full_name || "Unnamed"}</b>
                        </Link>
                      </td>
                      <td className="et-td-right">{b.sales}</td>
                      <td className="et-td-right et-money">{formatMoney(b.earned_minor)}</td>
                      <td className="et-td-right">{formatMoney(b.paid_minor)}</td>
                      <td className="et-td-right">{formatMoney(b.pending_minor)}</td>
                      <td className="et-td-right et-money">{formatMoney(Math.max(0, due))}</td>
                      <td className="et-td-right">
                        <PayoutForm instructorId={b.instructor_id} owedNaira={Math.max(0, due - b.pending_minor) / 100} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-empty">No instructor sales yet.</p>
        )}
      </section>

      <div className="et-grid-2">
        <section className="et-card">
          <div className="et-card-head">
            <h2>Recent payments</h2>
            <Link href="/admin/financials/payments">See all</Link>
          </div>
          {recent?.length ? (
            <table className="et-table">
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.buyer?.full_name || "Unknown buyer"}</b>
                      <small>{p.course?.title ?? "Course"}</small>
                    </td>
                    <td className="et-money et-td-right">{formatMoney(p.amount_minor, p.currency)}</td>
                    <td>
                      <Status value={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="et-empty">No payments yet. Paystack checkout isn&apos;t live yet; record bank transfers under All payments.</p>
          )}
        </section>
        <section className="et-card">
          <div className="et-card-head">
            <h2>Payouts</h2>
          </div>
          {payouts?.length ? (
            <table className="et-table">
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>{payoutNames.get(p.instructor_id) ?? "Instructor"}</b>
                      <small>{p.reference || formatDate(p.created_at)}</small>
                    </td>
                    <td className="et-money et-td-right">{formatMoney(p.amount_minor)}</td>
                    <td>
                      <Status value={p.status} />
                    </td>
                    <td className="et-td-right">
                      {p.status === "pending" && (
                        <span className="et-inline" style={{ justifyContent: "flex-end" }}>
                          <form action={setPayoutStatus}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="status" value="paid" />
                            <button type="submit" className="et-btn et-btn-success et-btn-sm">
                              Mark paid
                            </button>
                          </form>
                          <form action={setPayoutStatus}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="status" value="cancelled" />
                            <button type="submit" className="et-btn et-btn-ghost et-btn-sm">
                              Cancel
                            </button>
                          </form>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="et-empty">No payouts yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
