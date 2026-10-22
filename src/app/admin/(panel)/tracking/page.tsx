import { Suspense } from "react";
import Link from "next/link";
import { LearnerInsights } from "./LearnerInsights";
import { Activity, BookCheck, Eye, GraduationCap, UserPlus } from "lucide-react";
import { Kpi, change } from "@/components/dash/ui";
import { BarChart } from "@/components/dash/BarChart";
import { requireAdmin } from "@/lib/admin";
import { dayLabel, getActivityFeed, profileNames } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/format";
import { ActivityFeed } from "../ActivityFeed";
import { TABS, TrackingNav, parseRange, type Tab } from "./TrackingNav";

export const metadata = { title: "Tracking" };

const SUBS: Record<Tab, string> = {
  overview: "Learning and engagement",
  learners: "Who your learners are and what they want",
  content: "Courses and pages people use most",
  activity: "Latest learner and admin activity",
  traffic: "",
};

export default async function Tracking({ searchParams }: { searchParams: Promise<{ days?: string; from?: string; to?: string; tab?: string }> }) {
  const { db } = await requireAdmin("tracking");
  const params = await searchParams;
  const range = parseRange(params);
  const { days, end } = range;
  const tab = (TABS.find((t) => t.key === params.tab)?.key ?? "overview") as Tab;

  const [{ data: daily }, { data: active }, { data: pages }, { data: courses }, feed, { data: audit }] = await Promise.all([
    db.rpc("admin_daily_activity", { p_days: days * 2, p_end: end }),
    db.rpc("admin_active_users", { p_days: days, p_end: end }),
    db.rpc("admin_top_pages", { p_days: days, p_limit: 10, p_end: end }),
    db.rpc("admin_top_courses", { p_days: days, p_limit: 10, p_end: end }),
    getActivityFeed(db, 15),
    db.from("admin_audit_log").select("id, actor_id, action, target_type, target_id, created_at").order("created_at", { ascending: false }).limit(15),
  ]);
  // Twice the range is loaded so each number can be compared with the period before it.
  const all = daily ?? [];
  const rows = all.slice(-days);
  const before = all.slice(0, -days);
  type Key = "signups" | "enrollments" | "completions" | "page_views";
  const sum = (k: Key, list = rows) => list.reduce((n, d) => n + d[k], 0);
  const delta = (k: Key) => change(sum(k), sum(k, before));
  const compare = `vs previous ${days} days`;
  const series = (k: "signups" | "enrollments" | "completions" | "page_views" | "active_users") => rows.map((d) => ({ label: dayLabel(d.day), value: d[k] }));
  const actors = await profileNames(db, (audit ?? []).map((a) => a.actor_id));

  return (
    <div className="et-page">
      <TrackingNav tab={tab} range={range} sub={`${SUBS[tab]}, ${range.phrase}.`} />

      {tab === "overview" && (
        <>
          <div className="et-kpis">
            <Kpi label="Active users" value={active ?? 0} icon={Activity} compare={`unique people, ${range.phrase}`} />
            <Kpi label="Sign-ups" value={sum("signups")} icon={UserPlus} delta={delta("signups")} compare={compare} />
            <Kpi label="Enrollments" value={sum("enrollments")} icon={GraduationCap} delta={delta("enrollments")} compare={compare} />
            <Kpi label="Lessons completed" value={sum("completions")} icon={BookCheck} delta={delta("completions")} compare={compare} />
            <Kpi label="Page views" value={sum("page_views").toLocaleString("en-NG")} icon={Eye} delta={delta("page_views")} compare={compare} />
          </div>

      <div className="et-grid-2">
        <section className="et-card">
          <div className="et-card-head">
            <h2>Daily active users</h2>
          </div>
          <BarChart data={series("active_users")} />
        </section>
        <section className="et-card">
          <div className="et-card-head">
            <h2>Sign-ups per day</h2>
          </div>
          <BarChart data={series("signups")} />
        </section>
        <section className="et-card">
          <div className="et-card-head">
            <h2>Enrollments per day</h2>
          </div>
          <BarChart data={series("enrollments")} />
        </section>
        <section className="et-card">
          <div className="et-card-head">
            <h2>Lessons completed per day</h2>
          </div>
          <BarChart data={series("completions")} />
        </section>
      </div>
        </>
      )}

      {tab === "learners" && (
        <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
          <LearnerInsights db={db} />
        </Suspense>
      )}

      {tab === "content" && (
      <div className="et-grid-2">
        <section className="et-card">
          <div className="et-card-head">
            <h2>Top courses</h2>
          </div>
          {courses?.length ? (
            <table className="et-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th className="et-th-right">Enrollments</th>
                  <th className="et-th-right">Lessons done</th>
                  <th className="et-th-right">Learners</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.course_id}>
                    <td>
                      <Link href={`/admin/courses/${c.course_id}`}>
                        <b>{c.title}</b>
                      </Link>
                    </td>
                    <td className="et-td-right">{c.enrollments}</td>
                    <td className="et-td-right">{c.completions}</td>
                    <td className="et-td-right">{c.learners}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="et-empty">No course activity in this period.</p>
          )}
        </section>
        <section className="et-card">
          <div className="et-card-head">
            <h2>Most viewed pages</h2>
          </div>
          {pages?.length ? (
            <table className="et-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th className="et-th-right">Views</th>
                  <th className="et-th-right">Visitors</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.path}>
                    <td>
                      <b style={{ fontFamily: "var(--font-geist-mono)", fontWeight: 500, fontSize: 12.5 }}>{p.path}</b>
                    </td>
                    <td className="et-td-right">{p.views}</td>
                    <td className="et-td-right">{p.visitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="et-empty">No page views recorded yet.</p>
          )}
        </section>
      </div>
      )}

      {tab === "activity" && (
      <div className="et-grid-2">
        <section className="et-card">
          <div className="et-card-head">
            <h2>Latest activity</h2>
          </div>
          <ActivityFeed items={feed} />
        </section>
        <section className="et-card">
          <div className="et-card-head">
            <h2>Admin actions</h2>
          </div>
          {audit?.length ? (
            <ul className="et-feed">
              {audit.map((a) => (
                <li key={a.id}>
                  <span className="et-feed-dot" />
                  <span>
                    <b>{(a.actor_id && actors.get(a.actor_id)) || "Admin"}</b> {a.action.replace(".", " ").replace(/_/g, " ")}
                  </span>
                  <time>{formatDateTime(a.created_at)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="et-empty">No admin actions logged yet.</p>
          )}
        </section>
      </div>
      )}
    </div>
  );
}
