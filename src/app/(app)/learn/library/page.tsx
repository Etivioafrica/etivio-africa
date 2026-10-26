import Link from "next/link";
import { Download, Layers } from "lucide-react";
import { Empty, PageHead } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { getLibrary } from "@/lib/data/marketplace";
import { ITEM_TYPES } from "@/lib/marketplace";
import { formatBytes, formatDate } from "@/lib/format";

export const metadata = { title: "Library" };

// Templates, e-books and resource packs the learner owns, with their downloads. Courses stay in My courses.
export default async function Library({ searchParams }: { searchParams: Promise<{ purchased?: string }> }) {
  const [user, { purchased }] = await Promise.all([getCurrentUser(), searchParams]);
  const items = await getLibrary(user.id);
  const products = items.filter((i) => i.kind !== "bundle");
  const bundles = items.filter((i) => i.kind === "bundle");

  return (
    <div className="et-page">
      <PageHead title="Library" sub="Templates, e-books and resource packs you own. Download them any time." />
      {purchased && <p className="et-flash">Payment received, thank you! Your purchase is below, and a receipt is on its way to your inbox.</p>}
      {products.length ? (
        <div className="et-lib">
          {products.map((p) => (
            <article key={p.id} className="et-card et-lib-item">
              <div className="et-lib-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.coverUrl ? <img src={p.coverUrl} alt="" /> : <Layers size={22} />}
              </div>
              <div className="et-lib-main">
                <small className="et-course-tagline">{ITEM_TYPES[p.kind].label}</small>
                <h3>{p.live ? <Link href={`/products/${p.slug}`}>{p.title}</Link> : p.title}</h3>
                <p className="et-muted">
                  By {p.creator} · Added {formatDate(p.grantedAt)}
                  {p.formats.length ? ` · ${p.formats.join(", ")}` : ""}
                </p>
                <ul className="et-lib-files">
                  {p.files.map((f) => (
                    <li key={f.id}>
                      <span>{f.name}</span>
                      {f.size ? <small>{formatBytes(f.size)}</small> : null}
                      <a href={`/api/download/${f.id}`} className="et-btn et-btn-ghost et-btn-sm">
                        <Download size={14} /> Download
                      </a>
                    </li>
                  ))}
                  {!p.files.length && <li className="et-muted">The creator hasn&apos;t added files yet.</li>}
                </ul>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="et-card">
          <Empty title="Nothing in your library yet" action={{ href: "/learn/explore", label: "Explore the marketplace" }}>
            Templates, e-books and resource packs you get will appear here.
          </Empty>
        </section>
      )}
      {bundles.length > 0 && (
        <p className="et-muted" style={{ fontSize: 13 }}>
          From bundles: {bundles.map((b) => b.title).join(", ")}. Their courses are in My courses and their files are listed above.
        </p>
      )}
    </div>
  );
}
