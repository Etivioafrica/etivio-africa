import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, Layers, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { ITEM_TYPES } from "@/lib/marketplace";
import { formatDate, formatPrice } from "@/lib/format";
import { ListedToggle } from "./ListedToggle";

export const metadata = { title: "Marketplace" };

const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Needs review" },
  { key: "published", label: "Live" },
  { key: "draft", label: "Drafts" },
  { key: "rejected", label: "Changes requested" },
  { key: "archived", label: "Archived" },
  { key: "courses", label: "Courses" },
] as const;
const ALWAYS: string[] = ["", "published", "courses"];

type Props = { searchParams: Promise<{ status?: string }> };

export default function MarketplaceAdmin({ searchParams }: Props) {
  return (
    <div className="et-page">
      <div className="et-page-head">
        <div>
          <h1>Marketplace</h1>
          <p>Templates, e-books, resource packs and bundles, plus which published courses show on the marketplace. Tutors&apos; submissions wait here for review.</p>
        </div>
        <Link href="/admin/marketplace/new" className="et-btn et-btn-primary">
          <Plus size={15} /> New product
        </Link>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: Props) {
  const { status } = await searchParams;
  const { db } = await requireAdmin("marketplace");
  const [{ data: products }, { data: owners }, { data: downloads }, { data: courses }] = await Promise.all([
    db.from("products").select("id, kind, title, slug, cover_url, price_minor, currency, status, featured, updated_at, creator:profiles!products_creator_id_fkey(full_name)").order("updated_at", { ascending: false }),
    db.from("product_access").select("product_id"),
    db.from("product_downloads").select("product_id"),
    db
      .from("courses")
      .select("id, title, slug, cover_url, price_minor, currency, marketplace_listed, published_at, instructor:profiles!courses_instructor_id_fkey(full_name)")
      .eq("status", "published")
      .order("published_at", { ascending: false }),
  ]);
  const tally = (rows: { product_id: string }[] | null) => rows?.reduce((m, r) => m.set(r.product_id, (m.get(r.product_id) ?? 0) + 1), new Map<string, number>()) ?? new Map();
  const ownersBy = tally(owners);
  const downloadsBy = tally(downloads);
  const all = products ?? [];
  const shown = status ? all.filter((p) => p.status === status) : all;
  const count = (s: string) => (s === "courses" ? (courses ?? []).length : s ? all.filter((p) => p.status === s).length : all.length);

  return (
    <section className="et-card">
      <nav className="et-seg" style={{ margin: 16 }}>
        {/* Review-stage tabs only show when something is in them. */}
        {TABS.filter((t) => ALWAYS.includes(t.key) || count(t.key) > 0 || (status ?? "") === t.key).map((t) => (
          <Link key={t.key} href={t.key ? `/admin/marketplace?status=${t.key}` : "/admin/marketplace"} className={(status ?? "") === t.key ? "is-on" : ""}>
            {t.label}
            {count(t.key) > 0 && <span className="et-seg-count">{count(t.key)}</span>}
          </Link>
        ))}
      </nav>
      {status === "courses" ? (
        courses?.length ? (
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Tutor</th>
                  <th>Price</th>
                  <th>Published</th>
                  <th className="et-th-right">On marketplace</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/courses/${c.id}`} className="et-mk-row">
                        <span className="et-pd-thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {c.cover_url ? <img src={c.cover_url} alt="" /> : <BookOpen size={16} />}
                        </span>
                        <span>
                          <b>{c.title}</b>
                          <small>Course</small>
                        </span>
                      </Link>
                    </td>
                    <td>{c.instructor?.full_name || "Unknown"}</td>
                    <td>{c.price_minor ? formatPrice(c.price_minor, c.currency) : "Free"}</td>
                    <td className="et-muted">{c.published_at ? formatDate(c.published_at) : "–"}</td>
                    <td className="et-td-right">
                      <ListedToggle id={c.id} listed={c.marketplace_listed} title={c.title} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="et-card-pad et-muted">No published courses yet. Courses show here once they&apos;re published.</p>
        )
      ) : shown.length ? (
        <div className="et-table-wrap">
          <table className="et-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Creator</th>
                <th>Price</th>
                <th>Status</th>
                <th>Owners</th>
                <th>Downloads</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/marketplace/${p.id}`} className="et-mk-row">
                      <span className="et-pd-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.cover_url ? <img src={p.cover_url} alt="" /> : <Layers size={16} />}
                      </span>
                      <span>
                        <b>{p.title}</b>
                        <small>
                          {ITEM_TYPES[p.kind].label}
                          {p.featured ? " · Featured" : ""}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>{p.creator?.full_name || "Unknown"}</td>
                  <td>{p.price_minor ? formatPrice(p.price_minor, p.currency) : "Free"}</td>
                  <td>
                    <span className={`et-tag et-st-${p.status}`}>{TABS.find((t) => t.key === p.status)?.label ?? p.status}</span>
                  </td>
                  <td>{ownersBy.get(p.id) ?? 0}</td>
                  <td>{downloadsBy.get(p.id) ?? 0}</td>
                  <td className="et-muted">{formatDate(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="et-card-pad et-muted">{status ? "Nothing here." : "No products yet. Add your first template, e-book or bundle."}</p>
      )}
    </section>
  );
}
