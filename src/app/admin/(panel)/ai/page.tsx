import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { CalendarDays, MessageSquare, Sparkles, Users } from "lucide-react";
import { Stat } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { ASSISTANT_DAILY_LIMIT, LESSON_CHAT_DAILY_LIMIT } from "@/lib/ai";

export const metadata = { title: "AI usage" };

const FEATURES: Record<string, string> = {
  assistant: "Etivio AI",
  lesson_chat: "Study assistant",
  course_writer: "Course writer",
  thumbnail: "Covers",
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

export default function AiUsagePage() {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>AI usage</h1>
          <p>
            Who asked the AI for something, from the questions Etivio saves. Per person per day: {ASSISTANT_DAILY_LIMIT} for Etivio AI, {LESSON_CHAT_DAILY_LIMIT} for the study assistant, and set limits on the course writer and covers.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Usage />
      </Suspense>
    </div>
  );
}

async function Usage() {
  const { db } = await requireAdmin("tracking");
  await connection();
  const day = hoursAgo(24);
  const week = hoursAgo(24 * 7);
  const { data } = await db.from("ai_messages").select("user_id, feature, created_at").eq("role", "user").gte("created_at", week).limit(20000);
  const rows = data ?? [];
  const today = rows.filter((r) => r.created_at >= day);

  const by = new Map<string, { total: number; features: Map<string, number> }>();
  for (const r of today) {
    const u = by.get(r.user_id) ?? { total: 0, features: new Map() };
    u.total += 1;
    u.features.set(r.feature, (u.features.get(r.feature) ?? 0) + 1);
    by.set(r.user_id, u);
  }
  const top = [...by.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 50);
  const ids = top.map(([id]) => id);
  const { data: people } = ids.length ? await db.from("profiles").select("id, full_name, username").in("id", ids) : { data: [] };
  const nameOf = (id: string) => {
    const p = (people ?? []).find((x) => x.id === id);
    return { name: p?.full_name?.trim() || "Member", handle: p?.username ? `@${p.username}` : "" };
  };
  const weekUsers = new Set(rows.map((r) => r.user_id)).size;

  return (
    <>
      <div className="et-stats">
        <Stat label="Asked in the last 24 hours" value={today.length} icon={MessageSquare} />
        <Stat label="People today" value={by.size} icon={Users} />
        <Stat label="Asked in the last 7 days" value={rows.length} icon={CalendarDays} />
        <Stat label="People this week" value={weekUsers} icon={Sparkles} />
      </div>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Last 24 hours, by person</h2>
        </div>
        {top.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Total</th>
                  <th>What they used</th>
                </tr>
              </thead>
              <tbody>
                {top.map(([id, u]) => {
                  const p = nameOf(id);
                  return (
                    <tr key={id}>
                      <td>
                        <Link href={`/admin/users/${id}`}>{p.name}</Link>
                        <small style={{ display: "block", color: "var(--a-muted)" }}>{p.handle}</small>
                      </td>
                      <td>
                        <b>{u.total}</b>
                      </td>
                      <td>
                        {[...u.features.entries()]
                          .sort((a, b) => b[1] - a[1])
                          .map(([f, n]) => `${FEATURES[f] ?? f} ${n}`)
                          .join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-card-pad et-muted">Nobody has used the AI in the last 24 hours.</p>
        )}
        <p className="et-card-pad et-muted" style={{ fontSize: 12.5 }}>
          Not counted here: the automatic checks on posts and uploads, and anything run from a script. Those also use the daily Cloudflare AI allowance.
        </p>
      </section>
    </>
  );
}
