import Link from "next/link";
import { Activity, BookCheck, Eye, GraduationCap, UserPlus } from "lucide-react";
import { PageHead, Stat } from "@/components/dash/ui";
import { BarChart } from "@/components/dash/BarChart";
import { requireAdmin } from "@/lib/admin";
import { dayLabel, getActivityFeed, profileNames } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/format";
import { ActivityFeed } from "../ActivityFeed";

export const metadata = { title: "Tracking" };

const RANGES = [7, 30, 90] as const;

export default async function Tracking({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { db } = await requireAdmin("tracking");
  const daysParam = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(daysParam) ? daysParam : 30;

  const [{ data: daily }, { data: active }, { data: pages }, { data: courses }, feed, { data: audit }] = await Promise.all([
    db.rpc("admin_daily_activity", { p_days: days }),
    db.rpc("admin_active_users", { p_days: days }),
    db.rpc("admin_top_pages", { p_days: days, p_limit: 10 }),
    db.rpc("admin_top_courses", { p_days: days, p_limit: 10 }),
    getActivityFeed(db, 15),
    db.from("admin_audit_log").select("id, actor_id, action, target_type, target_id, created_at").order("created_at", { ascending: false }).limit(15),
  ]);
  const rows = daily ?? [];
  const sum = (k: "signups" | "enrollments" | "completions" | "page_views") => rows.reduce((n, d) => n + d[k], 0);
  const series = (k: "signups" | "enrollments" | "completions" | "page_views" | "active_users") => rows.map((d) => ({ label: dayLabel(d.day), value: d[k] }));
  const actors = await profileNames(db, (audit ?? []).map((a) => a.actor_id));

  return (
    <div className="et-page">
      <PageHead title="Tracking" sub={`Learning and engagement over the last ${days} days.`}>
        <div className="et-tabs">
          {RANGES.map((r) => (
            <Link key={r} href={`/admin/tracking?days=${r}`} className={r === days ? "is-on" : ""}>
              {r} days
            </Link>
          ))}
        </div>
      </PageHead>

      <div className="et-stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <Stat label="Active users" value={active ?? 0} icon={Activity} />
        <Stat label="Sign-ups" value={sum("signups")} icon={UserPlus} />
        <Stat label="Enrollments" value={sum("enrollments")} icon={GraduationCap} />
        <Stat label="Lessons completed" value={sum("completions")} icon={BookCheck} />
        <Stat label="Page views" value={sum("page_views")} icon={Eye} />
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
    </div>
  );
}
