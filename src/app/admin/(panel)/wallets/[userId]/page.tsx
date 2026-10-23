import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { Select } from "@/components/dash/Select";
import { requireAdmin } from "@/lib/admin";
import { WALLET_KIND_LABEL, walletBalance, walletHistory } from "@/lib/data/wallet";
import { formatDateTime, formatMoney } from "@/lib/format";
import { adjustWallet } from "../actions";

export const metadata = { title: "Wallet" };

type Props = { params: Promise<{ userId: string }> };

export default function UserWalletPage({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <UserWallet params={params} />
      </Suspense>
    </div>
  );
}

async function UserWallet({ params }: Props) {
  const { userId } = await params;
  const { db } = await requireAdmin("financials");
  const { data: profile } = await db.from("profiles").select("id, full_name").eq("id", userId).maybeSingle();
  if (!profile) notFound();
  const { data: auth } = await db.auth.admin.getUserById(userId);
  const person = { ...profile, email: auth.user?.email ?? "" };
  const [balance, history] = await Promise.all([walletBalance(userId), walletHistory(userId, 200)]);

  return (
    <>
      <p className="et-set-crumb">
        <Link href="/admin/wallets">Wallets</Link> <span>/</span> {person.full_name || person.email}
      </p>
      <div className="et-page-head">
        <div>
          <h1>{person.full_name || "Member"}</h1>
          <p>
            {person.email} · <Link href={`/admin/users/${person.id}`}>Open profile</Link>
          </p>
        </div>
      </div>
      <div className="et-gba-detail">
        <section className="et-card">
          <div className="et-card-head">
            <h2>History</h2>
          </div>
          {history.length ? (
            <ul className="et-wl-history">
              {history.map((t) => (
                <li key={t.id}>
                  <span className="et-wl-what">
                    <b>{WALLET_KIND_LABEL[t.kind] ?? "Wallet"}</b>
                    <small>
                      {t.note ? `${t.note} · ` : ""}
                      {formatDateTime(t.at)}
                      {t.orderRef ? ` · ${t.orderRef}` : ""}
                    </small>
                  </span>
                  <b className={t.amountMinor > 0 ? "et-wallet-in" : undefined}>
                    {t.amountMinor > 0 ? "+" : "−"}
                    {formatMoney(Math.abs(t.amountMinor))}
                  </b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="et-card-pad et-muted">No wallet activity yet.</p>
          )}
        </section>
        <aside className="et-gba-side">
          <section className="et-card et-card-pad et-wl-admin-balance">
            <small>Balance</small>
            <b>{formatMoney(balance)}</b>
          </section>
          <section className="et-card et-card-pad">
            <ActionForm action={adjustWallet} toast className="et-form">
              <input type="hidden" name="user_id" value={person.id} />
              <div className="et-field">
                <label htmlFor="wa-dir">Adjust</label>
                <Select id="wa-dir" name="direction" defaultValue="credit">
                  <option value="credit">Add money</option>
                  <option value="debit">Take money</option>
                </Select>
              </div>
              <div className="et-field">
                <label htmlFor="wa-amount">Amount (₦)</label>
                <input id="wa-amount" name="amount" inputMode="decimal" className="et-input" placeholder="e.g. 5000" />
              </div>
              <div className="et-field">
                <label htmlFor="wa-note">Reason</label>
                <input id="wa-note" name="note" className="et-input" maxLength={200} placeholder="Shown in their wallet history" />
              </div>
              <SubmitButton className="et-btn et-btn-primary et-btn-sm">Save adjustment</SubmitButton>
            </ActionForm>
          </section>
        </aside>
      </div>
    </>
  );
}
