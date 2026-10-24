import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CopyLink } from "@/components/dash/CopyLink";
import { requireAdmin } from "@/lib/admin";
import { couponLabel, couponState, type CouponRow } from "@/lib/data/coupons";
import { formatDateTime, formatMoney } from "@/lib/format";
import { CouponForm } from "../CouponForm";
import { CouponActions, CopyCode } from "../CouponActions";
import { pickableItems } from "../data";

export const metadata = { title: "Coupon" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export default function CouponPage(props: Props) {
  return (
    <div className="et-page">
      <Link href="/admin/coupons" className="et-back">
        <ArrowLeft size={15} /> Coupons
      </Link>
      <Suspense fallback={<div className="et-skel" style={{ height: 640 }} />}>
        <Coupon {...props} />
      </Suspense>
    </div>
  );
}

async function Coupon({ params, searchParams }: Props) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const { db } = await requireAdmin("coupons");
  const [{ data }, { data: uses }, items] = await Promise.all([
    db.from("coupons").select("*").eq("id", id).maybeSingle(),
    db.from("coupon_redemptions").select("id, email, discount_minor, created_at, order:orders(reference, total_minor, currency)").eq("coupon_id", id).order("created_at", { ascending: false }),
    pickableItems(),
  ]);
  if (!data) notFound();
  const coupon = data as CouponRow;
  const state = couponState(coupon, uses?.length ?? 0);
  const given = (uses ?? []).reduce((n, u) => n + u.discount_minor, 0);
  const link = `/checkout?coupon=${encodeURIComponent(coupon.code)}`;

  return (
    <>
      <div className="et-page-head">
        <div>
          <h1 className="et-cp-title-row">
            {coupon.code}
            <span className={`et-status et-status-${state.key === "published" ? "green" : state.key === "pending" ? "amber" : "grey"}`}>{state.label}</span>
          </h1>
          <p>
            {couponLabel(coupon)} · used {uses?.length ?? 0}
            {coupon.max_uses ? ` of ${coupon.max_uses}` : ""} {uses?.length === 1 ? "time" : "times"}
            {given ? ` · ${formatMoney(given)} given` : ""}
          </p>
        </div>
        <CouponActions id={coupon.id} code={coupon.code} active={coupon.active} />
      </div>
      {created && <p className="et-flash et-flash-ok">Coupon created. Share the code or the link below.</p>}

      <section className="et-card et-card-pad et-cp-share">
        <div>
          <b>Share it</b>
          <p>
            People can type <code>{coupon.code}</code> at checkout, or open this link and it&apos;s applied for them:
          </p>
          <code className="et-cp-link">etivio.co{link}</code>
        </div>
        <div className="et-cp-share-btns">
          <CopyCode code={coupon.code} />
          <CopyLink path={link} label="Copy checkout link" />
        </div>
      </section>

      <CouponForm coupon={coupon} items={items} />

      <section className="et-card">
        <div className="et-card-head">
          <h2>Who used it</h2>
        </div>
        {uses?.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Order</th>
                  <th>Discount</th>
                  <th>Paid</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {uses.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.order?.reference ?? "-"}</td>
                    <td>{formatMoney(u.discount_minor)}</td>
                    <td>{u.order ? formatMoney(u.order.total_minor, u.order.currency) : "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-card-pad et-muted">Nobody has used this coupon yet. Uses show here once their payment clears.</p>
        )}
      </section>
    </>
  );
}
