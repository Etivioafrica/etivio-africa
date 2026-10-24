import { Suspense } from "react";
import Link from "next/link";
import { Ban, Bot, Flag, ShieldAlert, ShieldCheck, UserX } from "lucide-react";
import { Stat } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { HIDE_AT_REPORTS, MUTE_AT, REASON_LABELS, SUSPEND_AT, TARGET_LABELS, type Reason, type TargetType } from "@/lib/moderation";
import { formatDate } from "@/lib/format";
import { FlagActions } from "./FlagActions";

export const metadata = { title: "Moderation" };

type Props = { searchParams: Promise<{ tab?: string }> };

const TABS = [
  ["open", "Needs a decision"],
  ["blocked", "Blocked automatically"],
  ["closed", "Decided"],
] as const;

// Where staff can see the thing in context.
function viewLink(type: TargetType, id: string | null, link: string | null) {
  if (!id) return null;
  if (type === "course") return `/admin/review/courses/${id}`;
  if (type === "product") return `/admin/review/products/${id}`;
  if (type === "profile") return `/admin/users/${id}`;
  return link;
}

// The page is rendered per request (it reads searchParams), so reading the clock here is fine.
const clock = () => Date.now();

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

export default function ModerationPage({ searchParams }: Props) {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>Moderation</h1>
          <p>
            Posts, messages, reviews and profiles that people reported or the checks caught. Removing something can give its author a strike: {MUTE_AT} strikes stop them posting for 7
            days, {SUSPEND_AT} suspend the account.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <Flags searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Row = {
  id: string;
  target_type: string;
  target_id: string | null;
  author_id: string | null;
  excerpt: string | null;
  link: string | null;
  source: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  author: { full_name: string | null; strikes: number; muted_until: string | null; status: string } | null;
};

async function Flags({ searchParams }: Props) {
  const { tab: raw } = await searchParams;
  const tab = TABS.some(([v]) => v === raw) ? raw! : "open";
  const { db } = await requireAdmin("moderation");
  const weekAgo = new Date(clock() - 7 * 86_400_000).toISOString();
  const statuses = tab === "open" ? ["open"] : tab === "blocked" ? ["blocked"] : ["removed", "dismissed"];
  const [{ data }, { count: open }, { count: blocked }, { count: removed }, { count: muted }] = await Promise.all([
    db
      .from("moderation_flags")
      .select("id, target_type, target_id, author_id, excerpt, link, source, reason, details, status, created_at, resolved_at, author:profiles!moderation_flags_author_id_fkey(full_name, strikes, muted_until, status)")
      .in("status", statuses)
      .order(tab === "closed" ? "resolved_at" : "created_at", { ascending: false })
      .limit(300),
    db.from("moderation_flags").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("moderation_flags").select("id", { count: "exact", head: true }).eq("status", "blocked").gte("created_at", weekAgo),
    db.from("moderation_flags").select("id", { count: "exact", head: true }).eq("status", "removed").gte("resolved_at", weekAgo),
    db.from("profiles").select("id", { count: "exact", head: true }).gt("muted_until", new Date().toISOString()),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  // Open flags on the same thing are one decision: group them, newest first.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = tab === "open" && r.target_id ? `${r.target_type}:${r.target_id}` : r.id;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <>
      <div className="et-stats">
        <Stat label="Needs a decision" value={open ?? 0} icon={ShieldAlert} />
        <Stat label="Blocked this week" value={blocked ?? 0} icon={Ban} hint="Stopped before anyone saw it" />
        <Stat label="Removed this week" value={removed ?? 0} icon={ShieldCheck} />
        <Stat label="People muted now" value={muted ?? 0} icon={UserX} />
      </div>
      <section className="et-card">
        <div className="et-filters">
          <nav className="et-seg" aria-label="Filter">
            {TABS.map(([v, label]) => (
              <Link key={v} href={`/admin/moderation?tab=${v}`} className={tab === v ? "is-on" : ""}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
        {groups.size ? (
          <ul className="et-md-list">
            {[...groups.values()].map((items) => {
              const f = items[0];
              const type = f.target_type as TargetType;
              const reports = items.filter((i) => i.source === "report");
              const auto = items.find((i) => i.source === "auto");
              const reasons = [...new Set(items.map((i) => REASON_LABELS[i.reason as Reason] ?? i.reason))];
              const view = viewLink(type, f.target_id, f.link);
              const held = f.status === "open" && (auto || reports.length >= HIDE_AT_REPORTS) && ["community_post", "community_comment", "message", "campus_post", "campus_comment"].includes(type);
              return (
                <li key={f.id} className="et-md-item">
                  <div className="et-md-top">
                    <span className="et-md-type">{TARGET_LABELS[type] ?? type}</span>
                    {reasons.map((r) => (
                      <span key={r} className="et-status et-status-red">
                        {r}
                      </span>
                    ))}
                    {held && <span className="et-status et-status-amber">Hidden until you decide</span>}
                    {f.status === "removed" && <span className="et-status et-status-grey">Removed</span>}
                    {f.status === "dismissed" && <span className="et-status et-status-green">Kept</span>}
                    <small className="et-md-when">{when(f.status === "open" || f.status === "blocked" ? f.created_at : (f.resolved_at ?? f.created_at))}</small>
                  </div>
                  {f.excerpt && <blockquote className="et-md-excerpt">{f.excerpt}</blockquote>}
                  <div className="et-md-meta">
                    <span>
                      {auto ? <Bot size={13} /> : <Flag size={13} />}
                      {auto ? (auto.details ?? "Caught by the checks") : null}
                      {auto && reports.length ? " · " : null}
                      {reports.length ? `Reported by ${reports.length} ${reports.length === 1 ? "person" : "people"}` : null}
                    </span>
                    {f.author_id ? (
                      <span>
                        By{" "}
                        <Link href={`/admin/users/${f.author_id}`}>{f.author?.full_name || "a user"}</Link>
                        {f.author && f.author.strikes > 0 && (
                          <>
                            {" · "}
                            <b className="et-md-strikes">
                              {f.author.strikes} {f.author.strikes === 1 ? "strike" : "strikes"}
                            </b>
                          </>
                        )}
                        {f.author?.status === "suspended" ? " · Suspended" : f.author?.muted_until && Date.parse(f.author.muted_until) > clock() ? ` · Muted until ${formatDate(f.author.muted_until)}` : null}
                      </span>
                    ) : (
                      <span>By a visitor</span>
                    )}
                    {view && (
                      <Link href={view} className="et-md-view">
                        View
                      </Link>
                    )}
                  </div>
                  {reports.some((r) => r.details) && (
                    <ul className="et-md-notes">
                      {reports
                        .filter((r) => r.details)
                        .map((r) => (
                          <li key={r.id}>&ldquo;{r.details}&rdquo;</li>
                        ))}
                    </ul>
                  )}
                  {f.status === "open" && <FlagActions flagId={f.id} label={TARGET_LABELS[type] ?? "Item"} hasAuthor={!!f.author_id} />}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="et-cp-empty">
            <span>
              <ShieldCheck size={20} />
            </span>
            <b>{tab === "open" ? "Nothing waiting" : tab === "blocked" ? "Nothing blocked" : "Nothing decided yet"}</b>
            <p>{tab === "open" ? "Reported and caught posts will show up here." : tab === "blocked" ? "Explicit posts and images stopped by the checks are listed here." : "Things you keep or remove are listed here."}</p>
          </div>
        )}
      </section>
    </>
  );
}
