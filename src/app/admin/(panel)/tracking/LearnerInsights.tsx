import type { SupabaseClient } from "@supabase/supabase-js";
import { Award, BadgeCheck, Compass, Globe } from "lucide-react";
import { StatStrip } from "@/components/dash/ui";
import type { Database } from "@/lib/database.types";
import { GOAL_LABELS, HOURS_LABELS, LEVEL_LABELS, TOPICS } from "@/lib/learner-prefs";

type Row = { label: string; value: number };

function Bars({ rows, total }: { rows: Row[]; total: number }) {
  return (
    <ul className="et-bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span>
          <span className="et-bar">
            <i style={{ width: `${total ? (r.value / total) * 100 : 0}%` }} />
          </span>
          <b>{r.value}</b>
        </li>
      ))}
    </ul>
  );
}

const tally = <K extends string>(labels: Record<K, string>, values: (string | null)[]) =>
  (Object.keys(labels) as K[]).map((k) => ({ label: labels[k], value: values.filter((v) => v === k).length }));

// What learners told us in the welcome guide, plus demand vs supply per topic: which courses to make next.
export async function LearnerInsights({ db }: { db: SupabaseClient<Database> }) {
  const [{ data: people }, { data: courses }, certs, badges] = await Promise.all([
    db.from("profiles").select("interests, skill_level, learning_goal, weekly_hours, onboarded_at, username, profile_public").is("deleted_at", null),
    db.from("courses").select("category").eq("status", "published"),
    db.from("certificates").select("code", { count: "exact", head: true }),
    db.from("user_badges").select("badge_id", { count: "exact", head: true }),
  ]);
  const all = people ?? [];
  const answered = all.filter((p) => p.skill_level || p.learning_goal || p.weekly_hours);
  const onboarded = all.filter((p) => p.onboarded_at).length;

  const demand = TOPICS.map((t) => ({
    topic: t,
    learners: all.filter((p) => (p.interests ?? []).some((i) => i.toLowerCase() === t.toLowerCase())).length,
    courses: (courses ?? []).filter((c) => c.category === t).length,
  })).sort((a, b) => b.learners - a.learners || a.topic.localeCompare(b.topic));

  return (
    <>
      <div className="et-tab-head" style={{ padding: 0 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Learner insights</h2>
          <p className="et-muted" style={{ fontSize: 13, marginTop: 2 }}>
            From the welcome guide. {answered.length} of {all.length} learners answered.
          </p>
        </div>
      </div>

      <StatStrip
        items={[
          { label: "Finished or skipped guide", value: `${onboarded} / ${all.length}`, icon: Compass },
          { label: "Public profiles", value: all.filter((p) => p.username && p.profile_public).length, icon: Globe },
          { label: "Certificates issued", value: certs.count ?? 0, icon: BadgeCheck },
          { label: "Badges earned", value: badges.count ?? 0, icon: Award },
        ]}
      />

      <div className="et-grid-2">
        <section className="et-card">
          <div className="et-card-head">
            <h2>Topic demand vs courses</h2>
            <span className="et-muted" style={{ fontSize: 12.5 }}>
              What to create next
            </span>
          </div>
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th className="et-th-right">Interested learners</th>
                  <th className="et-th-right">Published courses</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {demand.map((d) => (
                  <tr key={d.topic}>
                    <td>
                      <b>{d.topic}</b>
                    </td>
                    <td className="et-td-right">{d.learners}</td>
                    <td className="et-td-right">{d.courses}</td>
                    <td>{d.learners > 0 && d.courses === 0 ? <span className="et-status et-status-amber">Gap</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Why they&apos;re here</h2>
            </div>
            <Bars rows={tally(GOAL_LABELS, all.map((p) => p.learning_goal))} total={answered.length} />
          </section>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Skill level</h2>
            </div>
            <Bars rows={tally(LEVEL_LABELS, all.map((p) => p.skill_level))} total={answered.length} />
          </section>
          <section className="et-card">
            <div className="et-card-head">
              <h2>Time per week</h2>
            </div>
            <Bars rows={tally(HOURS_LABELS, all.map((p) => p.weekly_hours))} total={answered.length} />
          </section>
        </div>
      </div>
    </>
  );
}
