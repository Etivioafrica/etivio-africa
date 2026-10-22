import Link from "next/link";
import { Eye, LogIn, MousePointerClick, UserPlus, Users } from "lucide-react";
import { PageHead, Stat } from "@/components/dash/ui";
import { BarChart } from "@/components/dash/BarChart";
import { requireAdmin } from "@/lib/admin";
import { dayLabel } from "@/lib/data/admin";

export const metadata = { title: "Traffic" };

const RANGES = [7, 30, 90] as const;

type Row = { key: string; visits: number; visitors: number; bounces: number; signups: number };
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
const regions = new Intl.DisplayNames(["en"], { type: "region" });
const country = (code: string) => {
  if (code === "??") return "Unknown";
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
};

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

export default async function Traffic({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { db } = await requireAdmin("tracking");
  const daysParam = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(daysParam) ? daysParam : 30;

  const { data } = await db.rpc("admin_traffic_report", { p_days: days });
  const r = data as unknown as Report;
  const t = r.totals;

  return (
    <div className="et-page">
      <PageHead title="Traffic" sub={`Where visitors land and where they come from, last ${days} days. Sign-ups are credited to the person's first visit.`}>
        <div className="et-tabs">
          {RANGES.map((n) => (
            <Link key={n} href={`/admin/tracking/traffic?days=${n}`} className={n === days ? "is-on" : ""}>
              {n} days
            </Link>
          ))}
        </div>
      </PageHead>

      <div className="et-stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <Stat label="Visitors" value={t.visitors.toLocaleString("en-NG")} icon={Users} />
        <Stat label="Visits" value={t.visits.toLocaleString("en-NG")} icon={LogIn} />
        <Stat label="Pages per visit" value={t.visits ? (t.pages / t.visits).toFixed(1) : "0"} icon={Eye} />
        <Stat label="Bounce rate" value={pct(t.bounces, t.visits)} icon={MousePointerClick} />
        <Stat label="Sign-ups from visits" value={`${t.signups} (${pct(t.signups, t.visitors)})`} icon={UserPlus} />
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
      <div className="et-grid-2">
        <Breakdown title="Countries" label="Country" rows={r.countries} format={country} empty="No visits recorded yet." />
        <Breakdown title="Cities" label="City" rows={r.cities} signups={false} empty="No city data yet (only available on the live site)." />
      </div>
      <div className="et-grid-2">
        <Breakdown title="Devices" label="Device" rows={r.devices} empty="No visits recorded yet." />
      </div>
    </div>
  );
}
