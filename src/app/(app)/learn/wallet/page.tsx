import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Wallet } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { WALLET_KIND_LABEL, walletBalance, walletHistory } from "@/lib/data/wallet";
import { formatDateTime, formatMoney } from "@/lib/format";
import { TopUpForm } from "./TopUpForm";

export const metadata = { title: "Wallet" };

type Props = { searchParams: Promise<{ topup?: string }> };

export default function WalletPage({ searchParams }: Props) {
  return (
    <div className="et-page">
      <PageHead title="Wallet" sub="Money for courses on Etivio: group buys that didn't fill, top-ups and credits. It's used first at checkout." />
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: Props) {
  const [{ topup }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const [balance, history] = await Promise.all([walletBalance(user.id), walletHistory(user.id)]);
  const credited = history.filter((t) => t.amountMinor > 0).reduce((n, t) => n + t.amountMinor, 0);
  const spent = -history.filter((t) => t.amountMinor < 0).reduce((n, t) => n + t.amountMinor, 0);

  return (
    <>
      {topup === "done" && <p className="et-flash et-flash-ok">Top-up received. It&apos;s in your wallet now.</p>}
      {topup === "failed" && <p className="et-flash et-flash-warn">That payment didn&apos;t go through, so nothing was added. You can try again.</p>}
      <div className="et-wl-grid">
        <section className="et-wl-card">
          <div className="et-wl-card-top">
            <span className="et-wl-icon">
              <Wallet size={20} />
            </span>
            <span className="et-wl-brand">Etivio wallet</span>
          </div>
          <small>Available balance</small>
          <b className="et-wl-amountbig">{formatMoney(balance)}</b>
          <div className="et-wl-split">
            <span>
              <i>
                <ArrowDownLeft size={14} />
              </i>
              <span>
                <small>Added</small>
                <b>{formatMoney(credited)}</b>
              </span>
            </span>
            <span>
              <i>
                <ArrowUpRight size={14} />
              </i>
              <span>
                <small>Spent</small>
                <b>{formatMoney(spent)}</b>
              </span>
            </span>
          </div>
          <Link href="/explore" className="et-wl-spend">
            {balance > 0 ? "Find a course to spend it on" : "Browse courses"} <ArrowRight size={14} />
          </Link>
        </section>
        <section className="et-card et-card-pad">
          <TopUpForm />
        </section>
      </div>

      <section className="et-card">
        <div className="et-card-head">
          <h2>History</h2>
        </div>
        {history.length ? (
          <ul className="et-wl-history">
            {history.map((t) => (
              <li key={t.id}>
                <span className={`et-wl-dot${t.amountMinor > 0 ? " is-in" : ""}`}>{t.amountMinor > 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}</span>
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
          <p className="et-card-pad et-muted">Nothing here yet. Top up, or join a group buy: if a group doesn&apos;t fill, your money lands here.</p>
        )}
      </section>
    </>
  );
}
