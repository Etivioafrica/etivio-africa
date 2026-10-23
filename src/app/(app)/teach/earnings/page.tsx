import { redirect } from "next/navigation";
import { Banknote, Clock, HandCoins, Wallet } from "lucide-react";
import { PageHead, Stat, Status } from "@/components/dash/ui";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ITEM_TYPES } from "@/lib/marketplace";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import Link from "next/link";
import { compactMoney, formatDate, formatMoney } from "@/lib/format";
import { MIN_WITHDRAWAL_MINOR } from "@/lib/payouts";
import { WithdrawForm } from "./WithdrawForm";

export const metadata = { title: "Earnings" };

export default async function Earnings() {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");
  const supabase = await createClient();
  // Sales of their own courses and products. Product tables aren't readable by tutors directly, so this goes through
  // the server, filtered to this tutor.
  const db = createAdminClient();
  const [{ data: sales }, { data: payouts }, { data: settings }, { data: available }, { data: account }] = await Promise.all([
    createAdminClient()
      .from("payments")
      .select("id, amount_minor, instructor_share_minor, currency, status, paid_at, created_at, course:courses(title), product:products(title, kind)")
      .eq("instructor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("payouts").select("id, amount_minor, status, reference, paid_at, created_at").eq("instructor_id", user.id).order("created_at", { ascending: false }),
    supabase.from("platform_settings").select("commission_percent").single(),
    db.rpc("payout_available", { p_user: user.id }),
    db.from("payout_accounts").select("bank_name, account_number, verified_at").eq("user_id", user.id).maybeSingle(),
  ]);
  const availableMinor = Math.max(0, Number(available ?? 0));

  const ok = (sales ?? []).filter((s) => s.status === "success");
  const earned = ok.reduce((n, s) => n + s.instructor_share_minor, 0);
  const paid = (payouts ?? []).filter((p) => p.status === "paid").reduce((n, p) => n + p.amount_minor, 0);
  const scheduled = (payouts ?? []).filter((p) => p.status === "pending").reduce((n, p) => n + p.amount_minor, 0);
  const share = 100 - Number(settings?.commission_percent ?? 20);

  return (
    <div className="et-page">
      <PageHead title="Earnings" sub={`You keep ${share}% of every sale. Etivio pays out what you're owed.`} />
      <div className="et-stats">
        <Stat label="Available to withdraw" value={compactMoney(availableMinor)} icon={HandCoins} hint="Group buys still filling aren't counted yet" />
        <Stat label="Total earned" value={compactMoney(earned)} icon={Wallet} />
        <Stat label="Waiting to be paid" value={compactMoney(scheduled)} icon={Clock} />
        <Stat label="Paid to you" value={compactMoney(paid)} icon={Banknote} />
      </div>
      <section className="et-card et-card-pad et-wd-card">
        {account?.verified_at ? (
          <WithdrawForm availableMinor={availableMinor} minMinor={MIN_WITHDRAWAL_MINOR} bank={`${account.bank_name} (••••${account.account_number.slice(-4)})`} />
        ) : (
          <div className="et-wd-setup">
            <b>Add your bank account to withdraw</b>
            <p>We check the account with your bank, then you can withdraw what you&apos;ve earned.</p>
            <Link href="/settings/billing" className="et-btn et-btn-primary et-btn-sm">
              Add bank account
            </Link>
          </div>
        )}
      </section>
      <div className="et-grid-2">
        <section className="et-card">
          <div className="et-card-head">
            <h2>Sales</h2>
            <span className="et-muted">{ok.length}</span>
          </div>
          {sales?.length ? (
            <table className="et-table">
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.course?.title ?? s.product?.title ?? "Sale"}</b>
                      <small>
                        {s.product ? `${ITEM_TYPES[s.product.kind].label} · ` : "Course · "}
                        {formatDate(s.paid_at ?? s.created_at)} · sold for {formatMoney(s.amount_minor, s.currency)}
                      </small>
                    </td>
                    <td className="et-td-right et-money">{formatMoney(s.instructor_share_minor, s.currency)}</td>
                    <td>
                      <Status value={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="et-empty">No sales yet. Sales of your paid courses and marketplace products show up here.</p>
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
                      <b>{formatMoney(p.amount_minor)}</b>
                      <small>
                        {p.status === "pending" ? "Requested" : p.status === "paid" ? "Paid" : "Cancelled"} · {formatDate(p.paid_at ?? p.created_at)}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </small>
                    </td>
                    <td>
                      <Status value={p.status} />
                    </td>
                    <td>{p.paid_at ? formatDate(p.paid_at) : ""}</td>
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
