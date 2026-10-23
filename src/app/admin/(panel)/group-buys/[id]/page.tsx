import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { formatDateTime, formatMoney } from "@/lib/format";
import { closeGroup, extendGroup } from "../actions";

export const metadata = { title: "Group buy" };

type Props = { params: Promise<{ id: string }> };
const LABEL = { open: "Open", filled: "Filled", expired: "Didn't fill" } as const;

export default function GroupBuyPage({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <Group params={params} />
      </Suspense>
    </div>
  );
}

// One group: members and what each paid, plus extend or close for open groups.
async function Group({ params }: Props) {
  const { id } = await params;
  const { db } = await requireAdmin("marketplace");
  await connection();
  const { data: g } = await db
    .from("group_buys")
    .select("id, code, status, size, discount_percent, unit_price_minor, currency, expires_at, filled_at, created_at, course:courses(id, title, price_minor), starter:profiles!group_buys_created_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!g) notFound();
  const { data: members } = await db
    .from("group_buy_members")
    .select("user_id, joined_at, profile:profiles(full_name), order:orders(reference, email, total_minor, wallet_minor, status)")
    .eq("group_id", g.id)
    .order("joined_at");
  const { data: credits } = await db.from("wallet_transactions").select("user_id, amount_minor").eq("group_buy_id", g.id).eq("kind", "group_refund");
  const credited = new Map((credits ?? []).map((c) => [c.user_id, c.amount_minor]));
  const n = members?.length ?? 0;

  return (
    <>
      <p className="et-set-crumb">
        <Link href="/admin/group-buys">Group buys</Link> <span>/</span> {g.code}
      </p>
      <div className="et-page-head">
        <div>
          <h1>
            {g.course?.title ?? "Deleted course"} <span className={`et-tag et-gba-${g.status}`}>{LABEL[g.status]}</span>
          </h1>
          <p>
            Started by {g.starter?.full_name || "a member"} on {formatDateTime(g.created_at)} · {g.discount_percent}% off · {formatMoney(g.unit_price_minor, g.currency)} each
            {g.course ? ` (normally ${formatMoney(g.course.price_minor, g.currency)})` : ""}
          </p>
        </div>
        <Link href={`/groups/${g.code}`} className="et-btn et-btn-ghost" target="_blank">
          Open group page
        </Link>
      </div>

      <div className="et-gba-detail">
        <section className="et-card">
          <div className="et-card-head">
            <h2>
              Members ({n} of {g.size})
            </h2>
          </div>
          {n ? (
            <div className="et-table-wrap">
              <table className="et-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Joined</th>
                    <th>Paid</th>
                    <th>Order</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {(members ?? []).map((m) => (
                    <tr key={m.user_id}>
                      <td>
                        <Link href={`/admin/users/${m.user_id}`}>{m.profile?.full_name || "Member"}</Link>
                        <small style={{ display: "block", color: "var(--a-muted)" }}>{m.order?.email}</small>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(m.joined_at)}</td>
                      <td>
                        {m.order ? formatMoney(m.order.total_minor + m.order.wallet_minor, g.currency) : "—"}
                        {m.order && m.order.wallet_minor > 0 && <small style={{ display: "block", color: "var(--a-muted)" }}>{formatMoney(m.order.wallet_minor, g.currency)} from wallet</small>}
                      </td>
                      <td>{m.order?.reference ?? "—"}</td>
                      <td>{credited.has(m.user_id) ? `${formatMoney(credited.get(m.user_id)!, g.currency)} to wallet` : g.status === "filled" ? "Enrolled" : "Waiting"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="et-card-pad et-muted">Nobody has paid into this group yet.</p>
          )}
        </section>

        <aside className="et-gba-side">
          <section className="et-card et-card-pad">
            <dl className="et-kv">
              <dt>Places</dt>
              <dd>
                {n} of {g.size} taken
              </dd>
              <dt>Money in</dt>
              <dd>{formatMoney(g.unit_price_minor * n, g.currency)}</dd>
              <dt>{g.status === "open" ? "Closes" : g.status === "filled" ? "Filled" : "Closed"}</dt>
              <dd>{formatDateTime(g.status === "filled" ? g.filled_at : g.expires_at)}</dd>
              <dt>Code</dt>
              <dd>{g.code}</dd>
            </dl>
          </section>
          {g.status === "open" && (
            <>
              <section className="et-card et-card-pad">
                <ActionForm action={extendGroup} toast className="et-form">
                  <input type="hidden" name="id" value={g.id} />
                  <div className="et-field">
                    <label htmlFor="gba-days">Give it more time (days)</label>
                    <input id="gba-days" name="days" type="number" min={1} max={30} defaultValue={3} className="et-input" />
                  </div>
                  <SubmitButton className="et-btn et-btn-ghost et-btn-sm">Extend deadline</SubmitButton>
                </ActionForm>
              </section>
              <section className="et-card et-card-pad">
                <ActionForm action={closeGroup} toast className="et-form">
                  <input type="hidden" name="id" value={g.id} />
                  <small className="et-muted">Closing now credits every member&apos;s payment to their wallet, just like when time runs out.</small>
                  <SubmitButton className="et-btn et-btn-sm et-btn-danger-text">Close group and credit wallets</SubmitButton>
                </ActionForm>
              </section>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
