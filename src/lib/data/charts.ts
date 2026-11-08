import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin Charts: RevenueCat-style metrics built from tables Etivio already has.
// Everything is aggregated here from raw timestamps (Lagos time), so no migration is needed.
// Money is NGN only (amount_minor in kobo); payments in other currencies are left out.

export type Grain = "day" | "week" | "month";
export type Kind = "money" | "count" | "percent";
export type SeriesRow = { label: string; kind: Kind; values: number[]; primary?: boolean };
export type ChartResult = { buckets: string[]; rows: SeriesRow[]; total: number; prevTotal: number; kind: Kind };

import { METRICS, type MetricKey } from "@/lib/charts-metrics";
export { METRICS, type MetricKey };

const DAY = 86_400_000;
const LAGOS = 3_600_000; // UTC+1, no daylight saving

export type Period = { from: string; to: string; days: number; grain: Grain };

function bucketKey(ts: string, grain: Grain) {
  const d = new Date(Date.parse(ts) + LAGOS);
  if (grain === "month") return d.toISOString().slice(0, 7);
  if (grain === "week") {
    const dow = (d.getUTCDay() + 6) % 7; // Monday start
    return new Date(d.getTime() - dow * DAY).toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function bucketList(p: Period) {
  const out: string[] = [];
  for (let t = Date.parse(p.from); t <= Date.parse(p.to); t += DAY) {
    const k = bucketKey(new Date(t - LAGOS).toISOString(), p.grain);
    if (out[out.length - 1] !== k) out.push(k);
  }
  return out;
}

// Lagos-day boundaries as UTC ISO strings.
const startIso = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - LAGOS).toISOString();
const endIso = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + DAY - LAGOS).toISOString();

type Db = ReturnType<typeof createAdminClient>;

async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>, cap = 100_000) {
  const out: T[] = [];
  for (let i = 0; i < cap; i += 1000) {
    const { data } = await build(i, i + 999);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

type Raw = {
  payments: { status: string; amount_minor: number; platform_fee_minor: number | null; instructor_share_minor: number | null; currency: string; user_id: string | null; created_at: string; paid_at: string | null }[];
  orders: { status: string; created_at: string; paid_at: string | null }[];
  signups: { created_at: string }[];
  visits: { created_at: string; visitor_id: string }[];
  enrolled: { enrolled_at: string }[];
  completed: { completed_at: string }[];
  lessons: { completed_at: string; user_id: string }[];
  certs: { issued_at: string }[];
};

const NEEDS: Record<MetricKey, (keyof Raw)[]> = {
  revenue: ["payments"], platform: ["payments"], tutor_share: ["payments"], orders: ["orders"], aov: ["payments", "orders"],
  checkout_conv: ["orders"], customers: ["payments"], arppu: ["payments"], rev_per_signup: ["payments", "signups"], refunds: ["payments"],
  signups: ["signups"], visitors: ["visits"], signup_conv: ["signups", "visits"], enrollments: ["enrolled"],
  active: ["lessons"], lessons: ["lessons"], completions: ["completed"], certificates: ["certs"],
};

async function load(db: Db, need: Set<keyof Raw>, a: string, b: string): Promise<Raw> {
  const raw: Raw = { payments: [], orders: [], signups: [], visits: [], enrolled: [], completed: [], lessons: [], certs: [] };
  await Promise.all([
    need.has("payments") && all((x, y) => db.from("payments").select("status, amount_minor, platform_fee_minor, instructor_share_minor, currency, user_id, created_at, paid_at").gte("created_at", a).lt("created_at", b).range(x, y)).then((r) => (raw.payments = r as Raw["payments"])),
    need.has("orders") && all((x, y) => db.from("orders").select("status, created_at, paid_at").gte("created_at", a).lt("created_at", b).range(x, y)).then((r) => (raw.orders = r as Raw["orders"])),
    need.has("signups") && all((x, y) => db.from("profiles").select("created_at").gte("created_at", a).lt("created_at", b).range(x, y)).then((r) => (raw.signups = r as Raw["signups"])),
    need.has("visits") && all((x, y) => db.from("visits").select("created_at, visitor_id").gte("created_at", a).lt("created_at", b).range(x, y)).then((r) => (raw.visits = r as Raw["visits"])),
    need.has("enrolled") && all((x, y) => db.from("enrollments").select("enrolled_at").gte("enrolled_at", a).lt("enrolled_at", b).range(x, y)).then((r) => (raw.enrolled = r as Raw["enrolled"])),
    need.has("completed") && all((x, y) => db.from("enrollments").select("completed_at").not("completed_at", "is", null).gte("completed_at", a).lt("completed_at", b).range(x, y)).then((r) => (raw.completed = r as Raw["completed"])),
    need.has("lessons") && all((x, y) => db.from("lesson_progress").select("completed_at, user_id").not("completed_at", "is", null).gte("completed_at", a).lt("completed_at", b).range(x, y)).then((r) => (raw.lessons = r as Raw["lessons"])),
    need.has("certs") && all((x, y) => db.from("certificates").select("issued_at").gte("issued_at", a).lt("issued_at", b).range(x, y)).then((r) => (raw.certs = r as Raw["certs"])),
  ]);
  return raw;
}

// Sums (or distinct counts) per bucket, plus the whole-period figure.
function series<T>(rows: T[], keys: string[], grain: Grain, ts: (r: T) => string | null, val: (r: T) => number = () => 1) {
  const idx = new Map(keys.map((k, i) => [k, i]));
  const out = new Array(keys.length).fill(0);
  let total = 0;
  for (const r of rows) {
    const t = ts(r);
    if (!t) continue;
    const i = idx.get(bucketKey(t, grain));
    if (i === undefined) continue;
    const v = val(r);
    out[i] += v;
    total += v;
  }
  return { values: out, total };
}
function distinct<T>(rows: T[], keys: string[], grain: Grain, ts: (r: T) => string, id: (r: T) => string | null) {
  const idx = new Map(keys.map((k, i) => [k, i]));
  const sets = keys.map(() => new Set<string>());
  const whole = new Set<string>();
  for (const r of rows) {
    const k = id(r);
    const i = idx.get(bucketKey(ts(r), grain));
    if (!k || i === undefined) continue;
    sets[i].add(k);
    whole.add(k);
  }
  return { values: sets.map((s) => s.size), total: whole.size };
}
const ratio = (a: number[], b: number[], scale = 1) => a.map((v, i) => (b[i] ? (v / b[i]) * scale : 0));
const div = (a: number, b: number, scale = 1) => (b ? (a / b) * scale : 0);

function compute(key: MetricKey, raw: Raw, keys: string[], grain: Grain): { rows: SeriesRow[]; total: number } {
  const paid = raw.payments.filter((p) => p.status === "success" && p.currency === "NGN");
  const payTs = (p: Raw["payments"][number]) => p.paid_at ?? p.created_at;
  const rev = () => series(paid, keys, grain, payTs, (p) => p.amount_minor);
  const paidOrders = () => series(raw.orders.filter((o) => o.status === "success"), keys, grain, (o) => o.paid_at ?? o.created_at);
  const signups = () => series(raw.signups, keys, grain, (r) => r.created_at);
  const visitors = () => distinct(raw.visits, keys, grain, (r) => r.created_at, (r) => r.visitor_id);
  const custs = () => distinct(paid, keys, grain, payTs, (p) => p.user_id);
  const one = (label: string, kind: Kind, s: { values: number[]; total: number }) => ({ rows: [{ label, kind, values: s.values, primary: true }], total: s.total });

  switch (key) {
    case "revenue": return one("Revenue", "money", rev());
    case "platform": return one("Platform earnings", "money", series(paid, keys, grain, payTs, (p) => p.platform_fee_minor ?? 0));
    case "tutor_share": return one("Tutor earnings", "money", series(paid, keys, grain, payTs, (p) => p.instructor_share_minor ?? 0));
    case "orders": return one("Paid orders", "count", paidOrders());
    case "refunds": return one("Refunds", "money", series(raw.payments.filter((p) => p.status === "refunded" && p.currency === "NGN"), keys, grain, (p) => p.created_at, (p) => p.amount_minor));
    case "signups": return one("New sign-ups", "count", signups());
    case "visitors": return one("Visitors", "count", visitors());
    case "enrollments": return one("New enrolments", "count", series(raw.enrolled, keys, grain, (r) => r.enrolled_at));
    case "lessons": return one("Lessons completed", "count", series(raw.lessons, keys, grain, (r) => r.completed_at));
    case "active": return one("Active learners", "count", distinct(raw.lessons, keys, grain, (r) => r.completed_at, (r) => r.user_id));
    case "completions": return one("Courses completed", "count", series(raw.completed, keys, grain, (r) => r.completed_at));
    case "certificates": return one("Certificates issued", "count", series(raw.certs, keys, grain, (r) => r.issued_at));
    case "aov": {
      const r = rev(), o = paidOrders();
      return { rows: [{ label: "Paid orders", kind: "count", values: o.values }, { label: "Revenue", kind: "money", values: r.values }, { label: "Average order value", kind: "money", values: ratio(r.values, o.values), primary: true }], total: div(r.total, o.total) };
    }
    case "checkout_conv": {
      const started = series(raw.orders, keys, grain, (o) => o.created_at), done = paidOrders();
      return { rows: [{ label: "Checkouts started", kind: "count", values: started.values }, { label: "Paid", kind: "count", values: done.values }, { label: "Conversion", kind: "percent", values: ratio(done.values, started.values, 100), primary: true }], total: div(done.total, started.total, 100) };
    }
    case "customers": return one("Paying customers", "count", custs());
    case "arppu": {
      const r = rev(), c = custs();
      return { rows: [{ label: "Paying customers", kind: "count", values: c.values }, { label: "Revenue", kind: "money", values: r.values }, { label: "Revenue per customer", kind: "money", values: ratio(r.values, c.values), primary: true }], total: div(r.total, c.total) };
    }
    case "rev_per_signup": {
      const r = rev(), s = signups();
      return { rows: [{ label: "New sign-ups", kind: "count", values: s.values }, { label: "Revenue", kind: "money", values: r.values }, { label: "Revenue per sign-up", kind: "money", values: ratio(r.values, s.values), primary: true }], total: div(r.total, s.total) };
    }
    case "signup_conv": {
      const v = visitors(), s = signups();
      return { rows: [{ label: "Visitors", kind: "count", values: v.values }, { label: "New sign-ups", kind: "count", values: s.values }, { label: "Visitor to sign-up", kind: "percent", values: ratio(s.values, v.values, 100), primary: true }], total: div(s.total, v.total, 100) };
    }
  }
}

export async function getChart(key: MetricKey, p: Period): Promise<ChartResult> {
  const db = createAdminClient();
  const need = new Set(NEEDS[key]);
  const prevTo = new Date(Date.parse(p.from) - DAY).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(p.from) - p.days * DAY).toISOString().slice(0, 10);
  const raw = await load(db, need, startIso(prevFrom), endIso(p.to));
  const buckets = bucketList(p);
  const prevBuckets = bucketList({ ...p, from: prevFrom, to: prevTo, grain: "day" });
  const cur = compute(key, raw, buckets, p.grain);
  const prev = compute(key, raw, prevBuckets, "day");
  const kind = METRICS.find((m) => m.key === key)!.kind as Kind;
  return { buckets, rows: cur.rows, total: cur.total, prevTotal: prev.total, kind };
}

// Headline numbers for the "What to do" panel: current vs previous period for a few key metrics.
const PULSE: MetricKey[] = ["revenue", "platform", "signups", "visitors", "signup_conv", "checkout_conv", "enrollments", "active", "refunds"];

export async function getPulse(p: Period) {
  const db = createAdminClient();
  const need = new Set(PULSE.flatMap((k) => NEEDS[k]));
  const prevTo = new Date(Date.parse(p.from) - DAY).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(p.from) - p.days * DAY).toISOString().slice(0, 10);
  const raw = await load(db, need, startIso(prevFrom), endIso(p.to));
  const cur = bucketList({ ...p, grain: "day" });
  const prev = bucketList({ ...p, from: prevFrom, to: prevTo, grain: "day" });
  const out = {} as Record<MetricKey, { now: number; before: number }>;
  for (const k of PULSE) out[k] = { now: compute(k, raw, cur, "day").total, before: compute(k, raw, prev, "day").total };
  return out;
}

export type Pulse = Awaited<ReturnType<typeof getPulse>>;

const pctChange = (now: number, before: number) => (before ? ((now - before) / before) * 100 : now ? 100 : 0);

// Plain-language advice from the numbers. Kept rule-based so it is predictable and free to run.
export function advice(x: Pulse): { tone: "good" | "warn" | "bad"; title: string; body: string }[] {
  const tips: { tone: "good" | "warn" | "bad"; title: string; body: string }[] = [];
  const rev = pctChange(x.revenue.now, x.revenue.before);
  if (x.revenue.now === 0) tips.push({ tone: "bad", title: "No revenue in this period", body: "Nobody paid yet. Check that paid courses are published and listed, run a launch discount, or try a group buy to get the first sales." });
  else if (rev <= -15) tips.push({ tone: "bad", title: `Revenue is down ${Math.abs(Math.round(rev))}%`, body: "Promote your best-selling courses again, email past buyers about new courses, or run a time-limited coupon." });
  else if (rev >= 15) tips.push({ tone: "good", title: `Revenue is up ${Math.round(rev)}%`, body: "Find what drove it in Charts (orders, customers or order value) and do more of it." });

  if (x.visitors.now > 0 && x.signup_conv.now < 3) tips.push({ tone: "warn", title: `Only ${x.signup_conv.now.toFixed(1)}% of visitors sign up`, body: "Visitors are arriving but not joining. Make the sign-up button clearer, shorten the form, and lead with a free course or the Try Etivio AI demo." });
  if (x.visitors.before > 0 && pctChange(x.visitors.now, x.visitors.before) <= -20) tips.push({ tone: "warn", title: "Traffic dropped", body: "Fewer visitors than last period. Post more on social, share course links, and check Tracking > Traffic for which channel fell." });

  const startedCheckout = x.checkout_conv.now;
  if (startedCheckout > 0 && startedCheckout < 50) tips.push({ tone: "warn", title: `Only ${Math.round(startedCheckout)}% of checkouts get paid`, body: "Many people start paying and stop. Check the checkout reminder emails are running, show the price clearly earlier, and offer bank transfer." });

  if (x.revenue.now > 0 && x.refunds.now / x.revenue.now > 0.05) tips.push({ tone: "bad", title: "Refunds are above 5% of revenue", body: "Look at which courses are refunded most and review their quality and descriptions." });

  if (x.enrollments.now > 0 && x.active.now < x.enrollments.now * 0.3) tips.push({ tone: "warn", title: "Few new learners are actually learning", body: "People enrol but do not finish lessons. Use announcements, weekly goal reminders and WhatsApp nudges to bring them back." });

  if (x.signups.before > 0 && pctChange(x.signups.now, x.signups.before) >= 20) tips.push({ tone: "good", title: "Sign-ups are growing", body: "Turn new users into buyers: recommend a first paid course in the welcome email and on the Learn dashboard." });

  if (!tips.length) tips.push({ tone: "good", title: "Steady period", body: "Nothing unusual. Keep publishing courses and watch Revenue and Checkout conversion here each week." });
  return tips;
}
