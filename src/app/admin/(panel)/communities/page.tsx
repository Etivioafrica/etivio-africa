import { Suspense } from "react";
import Link from "next/link";
import { BadgeCheck, MessageSquareText, UserPlus, Users, UsersRound } from "lucide-react";
import { Stat } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { JOIN_LABEL, type JoinMode } from "@/lib/data/communities";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Communities" };

type Props = { searchParams: Promise<{ q?: string }> };

export default function AdminCommunitiesPage({ searchParams }: Props) {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>Communities</h1>
          <p>Every learner community on Etivio, who runs it and how active it is.</p>
        </div>
        <Link href="/communities/new" className="et-btn et-btn-primary">
          <UsersRound size={15} /> New community
        </Link>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <Communities searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Communities({ searchParams }: Props) {
  const { q } = await searchParams;
  const { db } = await requireAdmin("communities");
  const [{ data: communities }, { data: members }, { data: posts }] = await Promise.all([
    db.from("communities").select("id, slug, name, join_mode, is_official, status, created_at, owner_id").order("created_at", { ascending: false }),
    db.from("community_members").select("community_id, status"),
    db.from("community_posts").select("community_id"),
  ]);
  const ownerIds = [...new Set((communities ?? []).map((c) => c.owner_id).filter((id): id is string => !!id))];
  const { data: owners } = ownerIds.length ? await db.from("profiles").select("id, full_name").in("id", ownerIds) : { data: [] };
  const ownerName = new Map((owners ?? []).map((o) => [o.id, o.full_name]));

  const count = (rows: { community_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.community_id, (m.get(r.community_id) ?? 0) + 1);
    return m;
  };
  const active = count((members ?? []).filter((m) => m.status === "active"));
  const pending = count((members ?? []).filter((m) => m.status === "pending"));
  const postCount = count(posts);

  const all = communities ?? [];
  const term = q?.trim().toLowerCase() ?? "";
  const shown = all.filter((c) => !term || c.name.toLowerCase().includes(term) || (ownerName.get(c.owner_id ?? "") ?? "").toLowerCase().includes(term));

  return (
    <>
      <div className="et-stats">
        <Stat label="Communities" value={all.length} icon={UsersRound} />
        <Stat label="Members" value={[...active.values()].reduce((n, v) => n + v, 0)} icon={Users} />
        <Stat label="Posts" value={(posts ?? []).length} icon={MessageSquareText} />
        <Stat label="Waiting to join" value={[...pending.values()].reduce((n, v) => n + v, 0)} icon={UserPlus} hint="Requests owners haven't answered" />
      </div>
      <section className="et-card">
        <div className="et-filters">
          <form action="/admin/communities" style={{ marginLeft: "auto" }}>
            <input name="q" defaultValue={q ?? ""} className="et-input" placeholder="Name or owner" aria-label="Search communities" />
          </form>
        </div>
        {shown.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Community</th>
                  <th>Owner</th>
                  <th>Who can join</th>
                  <th>Members</th>
                  <th>Posts</th>
                  <th>Created</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/communities/${c.slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                        {c.name} {c.is_official && <BadgeCheck size={14} style={{ color: "var(--accent)" }} aria-label="Official" />}
                      </Link>
                    </td>
                    <td>{(c.owner_id && ownerName.get(c.owner_id)) || "Etivio"}</td>
                    <td>{JOIN_LABEL[c.join_mode as JoinMode] ?? c.join_mode}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {active.get(c.id) ?? 0}
                      {pending.get(c.id) ? <small style={{ display: "block", color: "var(--a-muted)" }}>{pending.get(c.id)} waiting</small> : null}
                    </td>
                    <td>{postCount.get(c.id) ?? 0}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(c.created_at)}</td>
                    <td>
                      <span className={`et-status et-status-${c.status === "active" ? "green" : "grey"}`}>{c.status === "active" ? "Active" : c.status.charAt(0).toUpperCase() + c.status.slice(1)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="et-cp-empty">
            <span>
              <UsersRound size={20} />
            </span>
            <b>{all.length ? "No communities match" : "No communities yet"}</b>
            <p>{all.length ? "Try another search." : "Tutors and staff can start one from the Communities page."}</p>
          </div>
        )}
      </section>
    </>
  );
}
