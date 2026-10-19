import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers, Plus } from "lucide-react";
import { Empty, PageHead } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { ITEM_TYPES } from "@/lib/marketplace";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata = { title: "Products" };

const STATUS: Record<string, string> = { draft: "Draft", pending: "In review", published: "Live", rejected: "Changes requested", archived: "Archived" };

export default async function TeachProducts() {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");
  const db = createAdminClient();
  const [{ data: products }, { data: owners }] = await Promise.all([
    db.from("products").select("id, kind, title, slug, cover_url, price_minor, currency, status, review_note, updated_at").eq("creator_id", user.id).order("updated_at", { ascending: false }),
    db.from("product_access").select("product_id, product:products!inner(creator_id)").eq("product.creator_id", user.id),
  ]);
  const ownersBy = new Map<string, number>();
  for (const o of owners ?? []) ownersBy.set(o.product_id, (ownersBy.get(o.product_id) ?? 0) + 1);

  return (
    <div className="et-page">
      <PageHead title="Products" sub="Sell templates, e-books, resource packs and bundles on the Etivio marketplace.">
        <Link href="/teach/products/new" className="et-btn et-btn-primary">
          <Plus size={15} /> New product
        </Link>
      </PageHead>
      {products?.length ? (
        <section className="et-card">
          <div className="et-table-wrap">
            <table className="et-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Owners</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/teach/products/${p.id}`} className="et-mk-row">
                        <span className="et-pd-thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.cover_url ? <img src={p.cover_url} alt="" /> : <Layers size={16} />}
                        </span>
                        <span>
                          <b>{p.title}</b>
                          <small>{ITEM_TYPES[p.kind].label}</small>
                        </span>
                      </Link>
                    </td>
                    <td>{p.price_minor ? formatPrice(p.price_minor, p.currency) : "Free"}</td>
                    <td>
                      <span className={`et-tag et-st-${p.status}`} title={p.review_note ?? undefined}>
                        {STATUS[p.status]}
                      </span>
                    </td>
                    <td>{ownersBy.get(p.id) ?? 0}</td>
                    <td className="et-muted">{formatDate(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="et-card">
          <Empty title="No products yet" action={{ href: "/teach/products/new", label: "Add your first product" }}>
            Templates, e-books and resource packs you add are reviewed by the Etivio team, then listed on the marketplace.
          </Empty>
        </section>
      )}
    </div>
  );
}
