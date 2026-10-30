import { Suspense } from "react";
import Link from "next/link";
import { Gift, Percent, ShoppingBag, UserPlus } from "lucide-react";
import { Stat } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { referralTerms } from "@/lib/data/referrals";
import { compactMoney, formatDate, formatMoney } from "@/lib/format";

export const metadata = { title: "Referrals" };

export default function ReferralsPage() {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>Referrals</h1>
          <p>People who joined through someone&apos;s invite link, and the wallet credit paid when they bought their first course.</p>
        </div>
        <Link href="/admin/settings/platform" className="et-btn et-btn-ghost">
          Reward settings
        </Link>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <Referrals />
      </Suspense>
    </div>
  );
}

async function Referrals() {
  const { db } = await requireAdmin("financials");
  const [{ data: friends }, { data: credits }, terms] = await Promise.all([
    db.from("profiles").select("id, full_name, username, referred_by, referred_at").not("referred_by", "is", null).order("referred_at", { ascending: false }).limit(5000),
    db.from("wallet_transactions").select("user_id, amount_minor, referral_friend_id").eq("kind", "referral").limit(10000),
    referralTerms(),
  ]);
  const list = friends ?? [];
  const inviterIds = [...new Set(list.map((f) => f.referred_by!))];
  const { data: inviters } = inviterIds.length ? await db.from("profiles").select("id, full_name, username").in("id", inviterIds) : { data: [] };
  const nameOf = (id: string) => {
    const p = (inviters ?? []).find((x) => x.id === id);
    return { name: p?.full_name?.trim() || "Member", handle: p?.username ? `@${p.username}` : "" };
  };

  // Credits to the inviter have referral_friend_id = the friend; the friend's own cash back points at themselves.
  const bought = new Set((credits ?? []).map((c) => c.referral_friend_id).filter(Boolean));
  const paid = (credits ?? []).reduce((n, c) => n + c.amount_minor, 0);
  type Row = { id: string; invited: number; bought: number; earned: number };
  const by = new Map<string, Row>();
  for (const f of list) {
    const r = by.get(f.referred_by!) ?? { id: f.referred_by!, invited: 0, bought: 0, earned: 0 };
    r.invited += 1;
    if (bought.has(f.id)) r.bought += 1;
    by.set(r.id, r);
  }
  for (const c of credits ?? []) if (c.referral_friend_id && c.referral_friend_id !== c.user_id && by.has(c.user_id)) by.get(c.user_id)!.earned += c.amount_minor;
  const top = [...by.values()].sort((a, b) => b.bought - a.bought || b.invited - a.invited).slice(0, 50);
  const converted = list.filter((f) => bought.has(f.id)).length;

  return (
    <>
      <div className="et-stats">
        <Stat label="Joined through invites" value={list.length} icon={UserPlus} hint={`${by.size} ${by.size === 1 ? "person has" : "people have"} invited someone`} />
        <Stat label="Bought a course" value={converted} icon={ShoppingBag} />
        <Stat label="Conversion" value={`${list.length ? Math.round((converted / list.length) * 100) : 0}%`} icon={Percent} hint="Invited people who bought" />
        <Stat label="Credit paid out" value={compactMoney(paid)} icon={Gift} hint={`${terms.percent}% to inviter, ${terms.friendPercent}% to friend, up to ${formatMoney(terms.capMinor)}`} />
      </div>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Top inviters</h2>
        </div>
        {top.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Invited</th>
                  <th>Bought</th>
                  <th>Earned</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => {
                  const p = nameOf(r.id);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/admin/users/${r.id}`}>{p.name}</Link>
                        <small style={{ display: "block", color: "var(--a-muted)" }}>{p.handle}</small>
                      </td>
                      <td>{r.invited}</td>
                      <td>{r.bought}</td>
                      <td>
                        <b>{formatMoney(r.earned)}</b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-card-pad et-muted">No one has joined through an invite link yet. Every learner has one under Invite friends.</p>
        )}
      </section>

      {list.length > 0 && (
        <section className="et-card">
          <div className="et-card-head">
            <h2>Recent sign-ups from invites</h2>
          </div>
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>New member</th>
                  <th>Invited by</th>
                  <th>Joined</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 50).map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/admin/users/${f.id}`}>{f.full_name?.trim() || "New member"}</Link>
                    </td>
                    <td>{nameOf(f.referred_by!).name}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(f.referred_at)}</td>
                    <td>{bought.has(f.id) ? <span className="et-status et-status-green">Bought</span> : <span className="et-status et-status-grey">Signed up</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
