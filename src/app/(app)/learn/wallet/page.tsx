import { Suspense } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Nfc } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { WALLET_KIND_LABEL, walletBalance, walletHistory } from "@/lib/data/wallet";
import { formatDateTime, formatMoney } from "@/lib/format";
import { TopUpForm } from "./TopUpForm";

export const metadata = { title: "Wallet" };

type Props = { searchParams: Promise<{ topup?: string; show?: string }> };

const TABS = [
  { value: "", label: "All" },
  { value: "in", label: "Money in" },
  { value: "out", label: "Money out" },
] as const;

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

// "Today", "Yesterday", then the date, in Lagos time so a late-night payment lands on the right day.
const LAGOS = { timeZone: "Africa/Lagos" } as const;
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", LAGOS);
function dayLabel(iso: string, now: number) {
  const key = dayKey(iso);
  if (key === dayKey(new Date(now).toISOString())) return "Today";
  if (key === dayKey(new Date(now - 86_400_000).toISOString())) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { ...LAGOS, day: "numeric", month: "long", year: "numeric" });
}

async function Content({ searchParams }: Props) {
  const [{ topup, show }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const [balance, history] = await Promise.all([walletBalance(user.id), walletHistory(user.id)]);
  const credited = history.filter((t) => t.amountMinor > 0).reduce((n, t) => n + t.amountMinor, 0);
  const spent = Math.abs(history.filter((t) => t.amountMinor < 0).reduce((n, t) => n + t.amountMinor, 0));
  const filter = show === "in" || show === "out" ? show : "";
  const shown = history.filter((t) => (filter === "in" ? t.amountMinor > 0 : filter === "out" ? t.amountMinor < 0 : true));
  const now = Date.now();
  const groups: { label: string; items: typeof shown }[] = [];
  for (const t of shown) {
    const label = dayLabel(t.at, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(t);
    else groups.push({ label, items: [t] });
  }

  return (
    <>
      {topup === "done" && <p className="et-flash et-flash-ok">Top-up received. It&apos;s in your wallet now.</p>}
      {topup === "failed" && <p className="et-flash et-flash-warn">That payment didn&apos;t go through, so nothing was added. You can try again.</p>}
      <div className="et-wl-grid">
        <div className="et-wl-left">
          <div className="et-wl-stack">
            <section className="et-wl-card" aria-label="Wallet balance">
              <div className="et-wl-card-top">
                <span className="et-wl-brand">Etivio</span>
                <Nfc size={22} />
              </div>
              <span className="et-wl-chip" aria-hidden />
              <small>Available balance</small>
              <b className="et-wl-amountbig">{formatMoney(balance)}</b>
              <div className="et-wl-card-foot">
                <span>
                  <small>
                    <ArrowDownLeft size={12} /> Added
                  </small>
                  <b>{formatMoney(credited)}</b>
                </span>
                <span>
                  <small>
                    <ArrowUpRight size={12} /> Spent
                  </small>
                  <b>{formatMoney(spent)}</b>
                </span>
              </div>
            </section>
          </div>
          <section className="et-card et-card-pad">
            <TopUpForm />
          </section>
          <Link href="/learn/explore" className="et-wl-spend">
            {balance > 0 ? "Find a course to spend it on" : "Browse courses"} <ArrowRight size={14} />
          </Link>
        </div>

        <section className="et-wl-right">
          <h2>Wallet activity</h2>
          <nav className="et-wl-tabs" aria-label="Filter activity">
            {TABS.map((t) => (
              <Link key={t.label} href={t.value ? `/learn/wallet?show=${t.value}` : "/learn/wallet"} className={filter === t.value ? "is-on" : ""} aria-current={filter === t.value ? "page" : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
          {groups.length ? (
            groups.map((g) => (
              <div key={g.label} className="et-wl-day">
                <h3>{g.label}</h3>
                <ul className="et-wl-history">
                  {g.items.map((t) => (
                    <li key={t.id}>
                      <span className={`et-wl-dot${t.amountMinor > 0 ? " is-in" : ""}`}>{t.amountMinor > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
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
              </div>
            ))
          ) : (
            <p className="et-muted et-wl-empty">
              {history.length ? "Nothing in this view." : "Nothing here yet. Top up, or join a group buy: if a group doesn't fill, your money lands here."}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
