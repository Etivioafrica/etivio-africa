import { redirect } from "next/navigation";
import { Banknote, Clock, HandCoins, Wallet } from "lucide-react";
import { PageHead, Stat, Status } from "@/components/dash/ui";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ITEM_TYPES } from "@/lib/marketplace";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { compactMoney, formatDate, formatMoney } from "@/lib/format";

export const metadata = { title: "Earnings" };

export default async function Earnings() {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");
  const supabase = await createClient();
  // Sales of their own courses and products. Product tables aren't readable by tutors directly, so this goes through
  // the server, filtered to this tutor.
  const [{ data: sales }, { data: payouts }, { data: settings }] = await Promise.all([
    createAdminClient()
      .from("payments")
      .select("id, amount_minor, instructor_share_minor, currency, status, paid_at, created_at, course:courses(title), product:products(title, kind)")
      .eq("instructor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("payouts").select("id, amount_minor, status, reference, paid_at, created_at").eq("instructor_id", user.id).order("created_at", { ascending: false }),
    supabase.from("platform_settings").select("commission_percent").single(),
  ]);

  const ok = (sales ?? []).filter((s) => s.status === "success");
  const earned = ok.reduce((n, s) => n + s.instructor_share_minor, 0);
  const paid = (payouts ?? []).filter((p) => p.status === "paid").reduce((n, p) => n + p.amount_minor, 0);
  const scheduled = (payouts ?? []).filter((p) => p.status === "pending").reduce((n, p) => n + p.amount_minor, 0);
  const share = 100 - Number(settings?.commission_percent ?? 20);

  return (
    <div className="et-page">
      <PageHead title="Earnings" sub={`You keep ${share}% of every sale. Etivio pays out what you're owed.`} />
      <div className="et-stats">
        <Stat label="Total earned" value={compactMoney(earned)} icon={Wallet} />
        <Stat label="Paid to you" value={compactMoney(paid)} icon={Banknote} />
        <Stat label="Scheduled" value={compactMoney(scheduled)} icon={Clock} />
        <Stat label="Still owed" value={compactMoney(Math.max(0, earned - paid))} icon={HandCoins} />
      </div>
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
                      <small>{p.reference || formatDate(p.created_at)}</small>
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
