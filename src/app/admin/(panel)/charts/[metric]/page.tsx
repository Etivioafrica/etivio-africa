import Link from "next/link";
import { Suspense } from "react";
import { ArrowDownRight, ArrowUpRight, CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { METRICS, advice, getChart, getPulse, type Grain, type Kind, type MetricKey, type Period } from "@/lib/data/charts";
import { ChartView } from "../ChartView";
import { fmt } from "../format";
import "../charts.css";

export const metadata = { title: "Charts" };

const PRESETS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];
const GRAINS: Grain[] = ["day", "week", "month"];
const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

type Search = { days?: string; grain?: string; from?: string; to?: string };

function parse(m: string, sp: Search) {
  const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
  const metric = (METRICS.find((x) => x.key === m)?.key ?? "revenue") as MetricKey;
  let from: string, to: string, days: number, custom = false;
  if (sp.from && sp.to && ISO.test(sp.from) && ISO.test(sp.to)) {
    [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    if (to > today) to = today;
    days = Math.min(731, Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1);
    from = new Date(Date.parse(to) - (days - 1) * DAY).toISOString().slice(0, 10);
    custom = true;
  } else {
    days = PRESETS.some((p) => p.days === Number(sp.days)) ? Number(sp.days) : 30;
    to = today;
    from = new Date(Date.parse(to) - (days - 1) * DAY).toISOString().slice(0, 10);
  }
  const fallback: Grain = days > 180 ? "month" : days > 60 ? "week" : "day";
  const grain = (GRAINS.includes(sp.grain as Grain) ? sp.grain : fallback) as Grain;
  return { metric, period: { from, to, days, grain } as Period, custom };
}

export default async function ChartsPage({ params, searchParams }: { params: Promise<{ metric: string }>; searchParams: Promise<Search> }) {
  await requireAdmin("financials");
  const [{ metric: m }, sp] = await Promise.all([params, searchParams]);
  const { metric, period, custom } = parse(m, sp);
  const qs = (patch: Partial<Search>) => {
    const base: Record<string, string> = { grain: period.grain };
    if (custom) Object.assign(base, { from: period.from, to: period.to });
    else base.days = String(period.days);
    const next = { ...base, ...patch } as Record<string, string | undefined>;
    if (patch.days) { delete next.from; delete next.to; }
    return `/admin/charts/${metric}?${new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][])}`;
  };

  return (
    <div className="et-page">
      <PageHead title="Charts" sub="Track money, growth and learning, and see what to do next.">
        <div className="et-ch-controls">
          <div className="et-ch-seg">
            {PRESETS.map((p) => (
              <Link key={p.days} href={qs({ days: String(p.days), grain: undefined })} className={!custom && period.days === p.days ? "is-on" : ""}>
                {p.label}
              </Link>
            ))}
          </div>
          <form className="et-ch-range" action={`/admin/charts/${metric}`}>
            <input type="date" name="from" defaultValue={period.from} aria-label="From" />
            <span>to</span>
            <input type="date" name="to" defaultValue={period.to} aria-label="To" />
            <button type="submit" className="et-btn et-btn-ghost">Apply</button>
          </form>
          <div className="et-ch-seg">
            {GRAINS.map((g) => (
              <Link key={g} href={qs({ grain: g })} className={period.grain === g ? "is-on" : ""}>
                {g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}
              </Link>
            ))}
          </div>
        </div>
      </PageHead>

      <Suspense fallback={<div className="et-card et-ch-pulse is-loading">Reading the numbers…</div>}>
        <PulsePanel period={period} />
      </Suspense>

      <div className="et-ch-layout is-single">
        <Suspense key={`${metric}-${period.from}-${period.to}-${period.grain}`} fallback={<div className="et-card et-ch-main is-loading">Loading chart…</div>}>
          <Chart metric={metric} period={period} />
        </Suspense>
      </div>
    </div>
  );
}

async function PulsePanel({ period }: { period: Period }) {
  const pulse = await getPulse(period);
  const tips = advice(pulse);
  const cards: { key: MetricKey; label: string; kind: Kind }[] = [
    { key: "revenue", label: "Revenue", kind: "money" },
    { key: "platform", label: "Etivio keeps", kind: "money" },
    { key: "signups", label: "New sign-ups", kind: "count" },
    { key: "checkout_conv", label: "Checkout conversion", kind: "percent" },
  ];
  const Icon = { good: CircleCheck, warn: TriangleAlert, bad: CircleAlert };
  return (
    <section className="et-card et-ch-pulse">
      <div className="et-ch-kpis">
        {cards.map((c) => {
          const { now, before } = pulse[c.key];
          const ch = before ? ((now - before) / before) * 100 : null;
          return (
            <div key={c.key}>
              <span>{c.label}</span>
              <b>{fmt(now, c.kind)}</b>
              {ch !== null ? (
                <small className={ch >= 0 ? "is-up" : "is-down"}>
                  {ch >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {Math.abs(ch).toFixed(0)}% vs previous {period.days} days
                </small>
              ) : (
                <small>No earlier data</small>
              )}
            </div>
          );
        })}
      </div>
      <div className="et-ch-tips">
        <h2>What to do</h2>
        {tips.map((t) => {
          const I = Icon[t.tone];
          return (
            <div key={t.title} className={`et-ch-tip is-${t.tone}`}>
              <I size={17} />
              <div>
                <b>{t.title}</b>
                <p>{t.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

async function Chart({ metric, period }: { metric: MetricKey; period: Period }) {
  const data = await getChart(metric, period);
  const meta = METRICS.find((m) => m.key === metric)!;
  return <ChartView title={meta.label} desc={meta.desc} grain={period.grain} days={period.days} data={data} />;
}
