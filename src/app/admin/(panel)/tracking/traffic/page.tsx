import { Eye, LogIn, MousePointerClick, UserPlus, Users } from "lucide-react";
import { Kpi, change } from "@/components/dash/ui";
import { BarChart } from "@/components/dash/BarChart";
import { requireAdmin } from "@/lib/admin";
import { dayLabel } from "@/lib/data/admin";
import { TrackingNav, parseRange } from "../TrackingNav";
import { Countries, type Row } from "./Countries";

export const metadata = { title: "Traffic" };

type Report = {
  totals: { visits: number; visitors: number; pages: number; bounces: number; signups: number };
  daily: { day: string; visits: number }[];
  landing: Row[];
  channels: Row[];
  sources: Row[];
  campaigns: Row[];
  countries: Row[];
  cities: Row[];
  devices: Row[];
};

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

function Breakdown({ title, rows, label, empty, mono, signups = true, format = (k) => k }: {
  title: string;
  rows: Row[];
  label: string;
  empty: string;
  mono?: boolean;
  signups?: boolean;
  format?: (key: string) => string;
}) {
  const top = Math.max(1, ...rows.map((r) => r.visits));
  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>{title}</h2>
      </div>
      {rows.length ? (
        <table className="et-table">
          <thead>
            <tr>
              <th>{label}</th>
              <th className="et-th-right">Visits</th>
              <th className="et-th-right">Bounce</th>
              {signups && <th className="et-th-right">Sign-ups</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>
                  <b style={mono ? { fontFamily: "var(--font-geist-mono)", fontWeight: 500, fontSize: 12.5 } : undefined}>{format(r.key)}</b>
                  <span style={{ display: "block", height: 3, marginTop: 6, borderRadius: 2, background: "var(--accent)", width: `${(r.visits / top) * 100}%` }} />
                </td>
                <td className="et-td-right">{r.visits.toLocaleString("en-NG")}</td>
                <td className="et-td-right">{pct(r.bounces, r.visits)}</td>
                {signups && (
                  <td className="et-td-right">
                    {r.signups}
                    {r.signups > 0 && <span style={{ opacity: 0.6, marginLeft: 6 }}>{pct(r.signups, r.visitors)}</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="et-empty">{empty}</p>
      )}
    </section>
  );
}

export default async function Traffic({ searchParams }: { searchParams: Promise<{ days?: string; from?: string; to?: string }> }) {
  const { db } = await requireAdmin("tracking");
  const range = parseRange(await searchParams);
  const { days, end } = range;

  // The doubled range gives the previous period's totals by subtraction (unique visitors don't add up, so they
  // get no comparison).
  const [{ data }, { data: doubled }] = await Promise.all([
    db.rpc("admin_traffic_report", { p_days: days, p_end: end }),
    db.rpc("admin_traffic_report", { p_days: days * 2, p_end: end }),
  ]);
  const r = data as unknown as Report;
  const t = r.totals;
  const d2 = (doubled as unknown as Report).totals;
  const prev = { visits: d2.visits - t.visits, pages: d2.pages - t.pages, bounces: d2.bounces - t.bounces, signups: d2.signups - t.signups };
  const rate = (n: number, d: number) => (d ? (n / d) * 100 : 0);
  const compare = `vs previous ${days} days`;

  return (
    <div className="et-page">
      <TrackingNav tab="traffic" range={range} sub={`Where visitors land and where they come from, ${range.phrase}. Sign-ups are credited to the first visit.`} />

      <div className="et-kpis">
        <Kpi label="Visitors" value={t.visitors.toLocaleString("en-NG")} icon={Users} compare="unique browsers" />
        <Kpi label="Visits" value={t.visits.toLocaleString("en-NG")} icon={LogIn} delta={change(t.visits, prev.visits)} compare={compare} />
        <Kpi label="Pages per visit" value={t.visits ? (t.pages / t.visits).toFixed(1) : "0"} icon={Eye} delta={prev.visits ? change(t.pages / Math.max(1, t.visits), prev.pages / prev.visits) : null} compare={compare} />
        <Kpi label="Bounce rate" value={pct(t.bounces, t.visits)} icon={MousePointerClick} delta={prev.visits && t.visits ? rate(t.bounces, t.visits) - rate(prev.bounces, prev.visits) : null} unit="pts" invert compare={compare} />
        <Kpi label="Sign-ups from visits" value={t.signups} icon={UserPlus} delta={change(t.signups, prev.signups)} compare={`${pct(t.signups, t.visitors)} of visitors`} />
      </div>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Visits per day</h2>
        </div>
        <BarChart data={r.daily.map((d) => ({ label: dayLabel(d.day), value: d.visits }))} />
      </section>

      <div className="et-grid-2">
        <Breakdown title="Top landing pages" label="First page" rows={r.landing} mono empty="No visits recorded yet." />
        <Breakdown title="Channels" label="Channel" rows={r.channels} empty="No visits recorded yet." />
      </div>
      <div className="et-grid-2">
        <Breakdown title="Sources" label="Site or utm_source" rows={r.sources} empty="No referring sites or campaign links yet." />
        <Breakdown title="Campaigns" label="utm_campaign" rows={r.campaigns} signups={false} empty="No campaign links used yet. Add ?utm_campaign=name to links you share." />
      </div>
      <Countries countries={r.countries} cities={r.cities} visitors={t.visitors} />
      <div className="et-grid-2">
        <Breakdown title="Devices" label="Device" rows={r.devices} empty="No visits recorded yet." />
      </div>
    </div>
  );
}
