import Link from "next/link";
import { BarChart3, CalendarDays, Check, ChevronDown } from "lucide-react";

export const RANGES = [7, 30, 90] as const;
export const TABS = [
  { key: "overview", label: "Overview" },
  { key: "learners", label: "Learners" },
  { key: "content", label: "Content" },
  { key: "activity", label: "Activity" },
  { key: "traffic", label: "Traffic" },
] as const;
export type Tab = (typeof TABS)[number]["key"];

// The period every report covers: `days` days ending on `end` (undefined = today, which the database defaults to).
export type Range = { days: number; end?: string; from?: string; to?: string; label: string; phrase: string; qs: string };

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const short = (iso: string, year = false) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });

export function parseRange(p: { days?: string; from?: string; to?: string }): Range {
  const today = new Date().toISOString().slice(0, 10);
  if (p.from && p.to && ISO.test(p.from) && ISO.test(p.to)) {
    let [from, to] = p.from <= p.to ? [p.from, p.to] : [p.to, p.from];
    if (to > today) to = today;
    if (from > to) from = to;
    // Capped at a year so the reports stay quick.
    const days = Math.min(366, Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1);
    from = new Date(Date.parse(to) - (days - 1) * DAY).toISOString().slice(0, 10);
    const label = `${short(from, from.slice(0, 4) !== to.slice(0, 4))} to ${short(to, true)}`;
    return { days, end: to, from, to, label, phrase: label, qs: `from=${from}&to=${to}` };
  }
  const n = Number(p.days);
  const days = (RANGES as readonly number[]).includes(n) ? n : 30;
  return { days, label: `Last ${days} days`, phrase: `last ${days} days`, qs: `days=${days}` };
}

const base = (tab: Tab) => (tab === "traffic" ? "/admin/tracking/traffic" : "/admin/tracking");
const href = (tab: Tab, qs: string) => (tab === "traffic" ? `${base(tab)}?${qs}` : `${base(tab)}?tab=${tab}&${qs}`);

// Breadcrumb, title, section tabs and date range shared by the Tracking and Traffic pages, so every section is one
// click away instead of a long scroll.
export function TrackingNav({ tab, range, sub }: { tab: Tab; range: Range; sub: string }) {
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="et-page-head">
        <div>
          <p className="et-set-crumb">
            <BarChart3 size={12} />
            <Link href={`/admin/tracking?${range.qs}`}>Tracking</Link> <span>/</span> {current.label}
          </p>
          <h1>Tracking</h1>
          <p>{sub}</p>
        </div>
        <details className="et-range" data-menu key={`${tab}-${range.qs}`}>
          <summary>
            <CalendarDays size={15} strokeWidth={1.9} />
            {range.label}
            <ChevronDown size={14} strokeWidth={2} className="et-range-chev" />
          </summary>
          <div className="et-range-menu">
            {RANGES.map((n) => {
              const on = !range.end && n === range.days;
              return (
                <Link key={n} href={href(tab, `days=${n}`)} className={on ? "is-on" : ""}>
                  Last {n} days
                  {on && <Check size={14} strokeWidth={2.2} />}
                </Link>
              );
            })}
            <form action={base(tab)} className="et-range-custom">
              <p className={range.end ? "is-on" : ""}>
                Custom range
                {range.end && <Check size={14} strokeWidth={2.2} />}
              </p>
              {tab !== "traffic" && <input type="hidden" name="tab" value={tab} />}
              <label>
                From
                <input type="date" name="from" required max={today} defaultValue={range.from} />
              </label>
              <label>
                To
                <input type="date" name="to" required max={today} defaultValue={range.to ?? today} />
              </label>
              <button type="submit" className="et-btn et-btn-primary">
                Apply
              </button>
            </form>
          </div>
        </details>
      </div>
      <nav className="et-seg" aria-label="Tracking sections" style={{ width: "fit-content" }}>
        {TABS.map((t) => (
          <Link key={t.key} href={href(t.key, range.qs)} className={t.key === tab ? "is-on" : ""} aria-current={t.key === tab ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
