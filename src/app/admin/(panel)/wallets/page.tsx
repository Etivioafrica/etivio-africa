import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Users, Wallet } from "lucide-react";
import { Stat } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { compactMoney, formatDateTime, formatMoney } from "@/lib/format";

export const metadata = { title: "Wallets" };

type Props = { searchParams: Promise<{ q?: string }> };

export default function WalletsPage({ searchParams }: Props) {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>Wallets</h1>
          <p>Money people hold on Etivio: group buys that didn&apos;t fill, top-ups and credits. It&apos;s owed to them until they spend it on courses.</p>
        </div>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <Wallets searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Wallets({ searchParams }: Props) {
  const { q } = await searchParams;
  const { db } = await requireAdmin("financials");
  const { data: rows } = await db.from("wallet_transactions").select("user_id, amount_minor, kind, created_at, profile:profiles!wallet_transactions_user_id_fkey(full_name, username)").order("created_at", { ascending: false }).limit(5000);
  type Row = { userId: string; name: string; email: string; balance: number; credited: number; spent: number; last: string };
  const by = new Map<string, Row>();
  for (const t of rows ?? []) {
    const r = by.get(t.user_id) ?? { userId: t.user_id, name: t.profile?.full_name || "Member", email: t.profile?.username ? `@${t.profile.username}` : "", balance: 0, credited: 0, spent: 0, last: t.created_at };
    r.balance += t.amount_minor;
    if (t.amount_minor > 0) r.credited += t.amount_minor;
    else r.spent -= t.amount_minor;
    by.set(t.user_id, r);
  }
  const all = [...by.values()].sort((a, b) => b.balance - a.balance);
  const term = q?.trim().toLowerCase() ?? "";
  const shown = all.filter((r) => !term || `${r.name} ${r.email}`.toLowerCase().includes(term));
  const sum = (k: "balance" | "credited" | "spent") => all.reduce((n, r) => n + r[k], 0);

  return (
    <>
      <div className="et-stats">
        <Stat label="Held in wallets" value={compactMoney(sum("balance"))} icon={Wallet} hint="Owed to people until they spend it" />
        <Stat label="People with a balance" value={all.filter((r) => r.balance > 0).length} icon={Users} />
        <Stat label="Credited in total" value={compactMoney(sum("credited"))} icon={ArrowDownLeft} />
        <Stat label="Spent on courses" value={compactMoney(sum("spent"))} icon={ArrowUpRight} />
      </div>
      <section className="et-card">
        <div className="et-filters">
          <form action="/admin/wallets" style={{ marginLeft: "auto" }}>
            <input name="q" defaultValue={q ?? ""} className="et-input" placeholder="Name or username" aria-label="Search wallets" />
          </form>
        </div>
        {shown.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Balance</th>
                  <th>In</th>
                  <th>Spent</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.userId}>
                    <td>
                      <Link href={`/admin/wallets/${r.userId}`}>{r.name}</Link>
                      <small style={{ display: "block", color: "var(--a-muted)" }}>{r.email}</small>
                    </td>
                    <td>
                      <b>{formatMoney(r.balance)}</b>
                    </td>
                    <td>{formatMoney(r.credited)}</td>
                    <td>{formatMoney(r.spent)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-card-pad et-muted">{all.length ? "No wallets match." : "No wallet activity yet. Wallets fill up when group buys don't fill, people top up, or you add a credit from someone's wallet page."}</p>
        )}
      </section>
    </>
  );
}
