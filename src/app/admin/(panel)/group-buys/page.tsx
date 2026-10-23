import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Banknote, CheckCircle2, Clock, Users } from "lucide-react";
import { Stat } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { compactMoney, formatDateTime, formatMoney } from "@/lib/format";

export const metadata = { title: "Group buys" };

const TABS = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "filled", label: "Filled" },
  { key: "expired", label: "Didn't fill" },
] as const;
const LABEL = { open: "Open", filled: "Filled", expired: "Didn't fill" } as const;

type Search = { status?: string; q?: string };
type Props = { searchParams: Promise<Search> };

export default function GroupBuysPage({ searchParams }: Props) {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>Group buys</h1>
          <p>Every group: who started it, how full it is, time left and the money in it. Switch group buy on per course from the course&apos;s Settings tab or the course builder.</p>
        </div>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <Groups searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const clock = () => Date.now();
function left(iso: string) {
  const ms = Date.parse(iso) - clock();
  if (ms <= 0) return "Time's up";
  const h = Math.floor(ms / 3_600_000);
  return h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h} hours left` : "Under an hour";
}

async function Groups({ searchParams }: Props) {
  const s = await searchParams;
  const { db } = await requireAdmin("marketplace");
  await connection();
  const [{ data: groups }, { data: members }] = await Promise.all([
    db
      .from("group_buys")
      .select("id, code, status, size, discount_percent, unit_price_minor, currency, expires_at, filled_at, created_at, course:courses(id, title), starter:profiles!group_buys_created_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("group_buy_members").select("group_id"),
  ]);
  const count = new Map<string, number>();
  for (const m of members ?? []) count.set(m.group_id, (count.get(m.group_id) ?? 0) + 1);
  // Groups nobody paid into (the starter left Paystack) aren't real groups; hide them.
  const all = (groups ?? []).filter((g) => (count.get(g.id) ?? 0) > 0);
  const q = s.q?.trim().toLowerCase() ?? "";
  const shown = all.filter((g) => (!s.status || g.status === s.status) && (!q || [g.code, g.course?.title ?? "", g.starter?.full_name ?? ""].join(" ").toLowerCase().includes(q)));
  const money = (status: string) => all.filter((g) => g.status === status).reduce((n, g) => n + g.unit_price_minor * (count.get(g.id) ?? 0), 0);
  const link = (patch: Partial<Search>) => {
    const next = new URLSearchParams(Object.entries({ ...s, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/group-buys${next.size ? `?${next}` : ""}`;
  };

  return (
    <>
      <div className="et-stats">
        <Stat label="Open groups" value={all.filter((g) => g.status === "open").length} icon={Clock} />
        <Stat label="Held in open groups" value={compactMoney(money("open"))} icon={Banknote} />
        <Stat label="Filled groups" value={all.filter((g) => g.status === "filled").length} icon={CheckCircle2} />
        <Stat label="Credited to wallets" value={compactMoney(money("expired"))} icon={Users} />
      </div>

      <section className="et-card">
        <div className="et-filters">
          <div className="et-tabs">
            {TABS.map((t) => (
              <Link key={t.key} href={link({ status: t.key })} className={(s.status ?? "") === t.key ? "is-on" : ""}>
                {t.label}
              </Link>
            ))}
          </div>
          <form action="/admin/group-buys" style={{ marginLeft: "auto" }}>
            {s.status && <input type="hidden" name="status" value={s.status} />}
            <input name="q" defaultValue={s.q ?? ""} className="et-input" placeholder="Course, code or starter" aria-label="Search group buys" />
          </form>
        </div>
        {shown.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Members</th>
                  <th>Price each</th>
                  <th>Money in</th>
                  <th>Started</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => {
                  const n = count.get(g.id) ?? 0;
                  return (
                    <tr key={g.id}>
                      <td>
                        <Link href={`/admin/group-buys/${g.id}`}>{g.course?.title ?? "Deleted course"}</Link>
                        <small style={{ display: "block", color: "var(--a-muted)" }}>
                          {g.code} · by {g.starter?.full_name || "a member"}
                        </small>
                      </td>
                      <td>
                        <div className="et-gba-progress">
                          <span>
                            {n} / {g.size}
                          </span>
                          <i>
                            <em style={{ width: `${Math.min(100, (n / g.size) * 100)}%` }} />
                          </i>
                        </div>
                      </td>
                      <td>
                        {formatMoney(g.unit_price_minor, g.currency)}
                        <small style={{ display: "block", color: "var(--a-muted)" }}>{g.discount_percent}% off</small>
                      </td>
                      <td>{formatMoney(g.unit_price_minor * n, g.currency)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(g.created_at)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{g.status === "open" ? left(g.expires_at) : g.status === "filled" && g.filled_at ? `Filled ${formatDateTime(g.filled_at)}` : `Closed ${formatDateTime(g.expires_at)}`}</td>
                      <td>
                        <span className={`et-tag et-gba-${g.status}`}>{LABEL[g.status]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-card-pad et-muted">{all.length ? "No groups match." : "No group buys yet. Switch group buy on for a paid course, then share it."}</p>
        )}
      </section>
    </>
  );
}
