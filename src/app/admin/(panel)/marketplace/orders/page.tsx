import { Suspense } from "react";
import Link from "next/link";
import { Banknote, Landmark, ShoppingBag, Users } from "lucide-react";
import { Stat, Status } from "@/components/dash/ui";
import { requireAdmin } from "@/lib/admin";
import { ITEM_TYPES } from "@/lib/marketplace";
import { compactMoney, formatDateTime, formatMoney } from "@/lib/format";
import { RecheckButton } from "./RecheckButton";

export const metadata = { title: "Orders" };

const STATUSES = [
  { key: "", label: "All" },
  { key: "success", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
] as const;

type Search = { status?: string; type?: string; q?: string };
type Props = { searchParams: Promise<Search> };

export default function OrdersPage({ searchParams }: Props) {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <p className="et-set-crumb">
            <Link href="/admin/marketplace">Marketplace</Link> <span>/</span> Orders
          </p>
          <h1>Orders</h1>
          <p>Every course and product purchase, with how each sale splits between Etivio and the creator.</p>
        </div>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 480 }} />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Orders({ searchParams }: Props) {
  const s = await searchParams;
  const { db } = await requireAdmin("marketplace");
  const { data } = await db
    .from("payments")
    .select(
      "id, reference, amount_minor, currency, platform_fee_minor, instructor_share_minor, status, provider, note, paid_at, created_at, course_id, product_id, buyer:profiles!payments_user_id_fkey(full_name), seller:profiles!payments_instructor_id_fkey(full_name), course:courses(title, slug), product:products(title, slug, kind), order:orders(reference, email, first_name, last_name, phone, country, state, reminders_sent)",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  const all = data ?? [];
  const q = s.q?.trim().toLowerCase() ?? "";
  const shown = all.filter(
    (p) =>
      (!s.status || p.status === s.status) &&
      (!s.type || (s.type === "course" ? !!p.course_id : !!p.product_id)) &&
      (!q || [p.reference, p.buyer?.full_name ?? "", p.order?.email ?? "", p.order?.phone ?? "", `${p.order?.first_name ?? ""} ${p.order?.last_name ?? ""}`, p.course?.title ?? "", p.product?.title ?? ""].join(" ").toLowerCase().includes(q)),
  );
  const paid = all.filter((p) => p.status === "success");
  const sum = (key: "amount_minor" | "platform_fee_minor" | "instructor_share_minor") => paid.reduce((n, p) => n + p[key], 0);
  const link = (patch: Partial<Search>) => {
    const next = new URLSearchParams(Object.entries({ ...s, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/marketplace/orders${next.size ? `?${next}` : ""}`;
  };

  return (
    <>
      <div className="et-stats">
        <Stat label="Revenue" value={compactMoney(sum("amount_minor"))} icon={Banknote} />
        <Stat label="Paid orders" value={paid.length} icon={ShoppingBag} />
        <Stat label="Etivio's share" value={compactMoney(sum("platform_fee_minor"))} icon={Landmark} />
        <Stat label="Creators' share" value={compactMoney(sum("instructor_share_minor"))} icon={Users} />
      </div>

      <section className="et-card">
        <div className="et-filters">
          <div className="et-tabs">
            {STATUSES.map((t) => (
              <Link key={t.key} href={link({ status: t.key })} className={(s.status ?? "") === t.key ? "is-on" : ""}>
                {t.label}
              </Link>
            ))}
          </div>
          <div className="et-tabs">
            <Link href={link({ type: "" })} className={!s.type ? "is-on" : ""}>
              Everything
            </Link>
            <Link href={link({ type: "course" })} className={s.type === "course" ? "is-on" : ""}>
              Courses
            </Link>
            <Link href={link({ type: "product" })} className={s.type === "product" ? "is-on" : ""}>
              Products
            </Link>
          </div>
          <form action="/admin/marketplace/orders" style={{ marginLeft: "auto" }}>
            {s.status && <input type="hidden" name="status" value={s.status} />}
            {s.type && <input type="hidden" name="type" value={s.type} />}
            <input name="q" defaultValue={s.q ?? ""} className="et-input" placeholder="Reference, buyer, email or item" aria-label="Search orders" />
          </form>
        </div>
        {shown.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Buyer</th>
                  <th>Item</th>
                  <th>Amount</th>
                  <th>Split</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const title = p.course?.title ?? p.product?.title ?? "Deleted item";
                  const href = p.course ? `/courses/${p.course.slug}` : p.product ? `/admin/marketplace/${p.product_id}` : null;
                  return (
                    <tr key={p.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(p.paid_at ?? p.created_at)}</td>
                      <td>
                        {p.order ? `${p.order.first_name} ${p.order.last_name}` : p.buyer?.full_name || "Deleted account"}
                        {p.order && (
                          <small style={{ display: "block", color: "var(--a-muted)" }}>
                            {p.order.email}
                            {p.order.phone ? ` · ${p.order.phone}` : ""}
                            {p.order.country ? ` · ${[p.order.state, p.order.country].filter(Boolean).join(", ")}` : ""}
                          </small>
                        )}
                        {p.status !== "success" && p.order && p.order.reminders_sent > 0 && (
                          <small style={{ display: "block", color: "var(--a-muted)" }}>
                            {p.order.reminders_sent} of 4 reminders sent
                          </small>
                        )}
                      </td>
                      <td>
                        {href ? <Link href={href}>{title}</Link> : title}
                        <small style={{ display: "block", color: "var(--a-muted)" }}>
                          {p.product ? ITEM_TYPES[p.product.kind].label : "Course"} · {p.reference}
                        </small>
                      </td>
                      <td className="et-money">{formatMoney(p.amount_minor, p.currency)}</td>
                      <td>
                        <small style={{ color: "var(--a-muted)" }}>
                          Etivio {formatMoney(p.platform_fee_minor, p.currency)}
                          {p.instructor_share_minor ? ` · ${p.seller?.full_name || "Creator"} ${formatMoney(p.instructor_share_minor, p.currency)}` : ""}
                        </small>
                      </td>
                      <td title={p.note ?? undefined}>
                        <Status value={p.status} />
                      </td>
                      <td style={{ textAlign: "right" }}>{p.status === "pending" && p.provider === "paystack" && <RecheckButton reference={p.reference} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-card-pad et-muted">{all.length ? "No orders match these filters." : "No orders yet. Paid courses and products bought through Paystack show up here."}</p>
        )}
      </section>
    </>
  );
}
