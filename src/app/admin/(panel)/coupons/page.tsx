import { Suspense } from "react";
import Link from "next/link";
import { Plus, Tag, TicketPercent, TrendingDown, Users } from "lucide-react";
import { Stat } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { couponLabel, couponState, type CouponRow } from "@/lib/data/coupons";
import { compactMoney, formatDate, formatMoney } from "@/lib/format";

export const metadata = { title: "Coupons" };

type Props = { searchParams: Promise<{ q?: string; show?: string }> };

export default function CouponsPage({ searchParams }: Props) {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>Coupons</h1>
          <p>Discount codes for checkout. Make one for everyone, a cohort, a partner, or a single person.</p>
        </div>
        <Link href="/admin/coupons/new" className="et-btn et-btn-primary">
          <Plus size={15} /> New coupon
        </Link>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <Coupons searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Coupons({ searchParams }: Props) {
  const { q, show = "all" } = await searchParams;
  const { db } = await requireAdmin("coupons");
  const [{ data: coupons }, { data: uses }] = await Promise.all([
    db.from("coupons").select("*").order("created_at", { ascending: false }),
    db.from("coupon_redemptions").select("coupon_id, discount_minor, email"),
  ]);
  const stats = new Map<string, { uses: number; off: number }>();
  for (const u of uses ?? []) {
    const s = stats.get(u.coupon_id) ?? { uses: 0, off: 0 };
    s.uses += 1;
    s.off += u.discount_minor;
    stats.set(u.coupon_id, s);
  }
  const rows = ((coupons ?? []) as (CouponRow & { created_at: string })[]).map((c) => {
    const s = stats.get(c.id) ?? { uses: 0, off: 0 };
    return { ...c, ...s, state: couponState(c, s.uses) };
  });
  const term = q?.trim().toUpperCase() ?? "";
  const shown = rows.filter((r) => (!term || r.code.includes(term) || (r.description ?? "").toUpperCase().includes(term)) && (show === "all" || (show === "active" ? r.state.label === "Active" : r.state.label !== "Active")));
  const scope = (r: CouponRow) =>
    r.applies_to === "all" ? "Everything" : r.applies_to === "courses" ? "All courses" : r.applies_to === "products" ? "All products" : `${r.course_ids.length + r.product_ids.length} chosen`;

  return (
    <>
      <div className="et-stats">
        <Stat label="Active coupons" value={rows.filter((r) => r.state.label === "Active").length} icon={Tag} />
        <Stat label="Times used" value={(uses ?? []).length} icon={TicketPercent} />
        <Stat label="Discount given" value={compactMoney((uses ?? []).reduce((n, u) => n + u.discount_minor, 0))} icon={TrendingDown} hint="Taken off paid orders" />
        <Stat label="People who used one" value={new Set((uses ?? []).map((u) => u.email)).size} icon={Users} />
      </div>
      <section className="et-card">
        <div className="et-filters">
          <nav className="et-seg" aria-label="Filter coupons">
            {[
              ["all", "All"],
              ["active", "Active"],
              ["inactive", "Off or ended"],
            ].map(([v, label]) => (
              <Link key={v} href={`/admin/coupons?show=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={show === v ? "is-on" : ""}>
                {label}
              </Link>
            ))}
          </nav>
          <form action="/admin/coupons" style={{ marginLeft: "auto" }}>
            <input type="hidden" name="show" value={show} />
            <input name="q" defaultValue={q ?? ""} className="et-input" placeholder="Code or note" aria-label="Search coupons" />
          </form>
        </div>
        {shown.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Applies to</th>
                  <th>For</th>
                  <th>Used</th>
                  <th>Ends</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/admin/coupons/${r.id}`} className="et-cp-code-cell">
                        {r.code}
                      </Link>
                      {r.description && <small style={{ display: "block", color: "var(--a-muted)" }}>{r.description}</small>}
                    </td>
                    <td>
                      <b>{couponLabel(r)}</b>
                    </td>
                    <td>{scope(r)}</td>
                    <td>{r.emails.length ? `${r.emails.length} ${r.emails.length === 1 ? "person" : "people"}` : "Anyone"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {r.uses}
                      {r.max_uses ? ` / ${r.max_uses}` : ""}
                      {r.off > 0 && <small style={{ display: "block", color: "var(--a-muted)" }}>{formatMoney(r.off)} off</small>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.ends_at ? formatDate(r.ends_at) : "Never"}</td>
                    <td>
                      <span className={`et-status et-status-${r.state.key === "published" ? "green" : r.state.key === "pending" ? "amber" : "grey"}`}>{r.state.label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="et-cp-empty">
            <span>
              <Tag size={20} />
            </span>
            <b>{rows.length ? "No coupons match" : "No coupons yet"}</b>
            <p>{rows.length ? "Try another search or filter." : "Make a code like WELCOME20 for everyone, or one only certain people can use."}</p>
            {!rows.length && (
              <Link href="/admin/coupons/new" className="et-btn et-btn-primary">
                <Plus size={15} /> New coupon
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}
