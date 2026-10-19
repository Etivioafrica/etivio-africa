// GitHub-style learning activity: one cell per day for the last year, shaded by lessons completed.

// Days are bucketed in Lagos time (WAT, UTC+1) so a lesson finished just after midnight counts for the right day.
const TZ = "Africa/Lagos";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

export type HeatCell = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4; future: boolean };
export type Heatmap = {
  weeks: HeatCell[][];
  months: { label: string; week: number }[];
  total: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
};

export function dailyCounts(timestamps: string[]) {
  const out: Record<string, number> = {};
  for (const t of timestamps) {
    const k = dayKey(new Date(t));
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

const level = (n: number): HeatCell["level"] => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4);

// UTC-midnight date for a YYYY-MM-DD key, so stepping by 86 400 000 ms never drifts across DST.
const fromKey = (k: string) => new Date(`${k}T00:00:00Z`);
const toKey = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;

// 53 columns (weeks, Sunday first) ending with the week that contains `now`.
export function buildHeatmap(daily: Record<string, number>, now: Date): Heatmap {
  const today = fromKey(dayKey(now));
  const start = new Date(today.getTime() - (52 * 7 + today.getUTCDay()) * DAY);

  const weeks: HeatCell[][] = [];
  const months: Heatmap["months"] = [];
  let total = 0;
  let activeDays = 0;
  for (let w = 0; w < 53; w++) {
    const week: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY);
      const key = toKey(date);
      const future = date > today;
      const count = future ? 0 : (daily[key] ?? 0);
      if (count) {
        total += count;
        activeDays += 1;
      }
      week.push({ date: key, count, level: level(count), future });
      // Label a month on the first week whose first day falls in it.
      if (d === 0 && date.getUTCDate() <= 7) months.push({ label: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), week: w });
    }
    weeks.push(week);
  }

  // Streaks over all recorded days, not just the visible year.
  const days = Object.keys(daily).filter((k) => daily[k] > 0).sort();
  let longest = 0;
  let run = 0;
  let prev = 0;
  for (const k of days) {
    const t = fromKey(k).getTime();
    run = prev && t - prev === DAY ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  // Current streak still counts if today has nothing yet but yesterday does.
  let current = 0;
  let cursor = daily[toKey(today)] ? today.getTime() : today.getTime() - DAY;
  while (daily[toKey(new Date(cursor))]) {
    current += 1;
    cursor -= DAY;
  }

  return { weeks, months, total, activeDays, currentStreak: current, longestStreak: longest };
}
