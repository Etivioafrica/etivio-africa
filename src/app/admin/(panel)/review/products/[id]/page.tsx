import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Download, ShieldCheck, X } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { ITEM_TYPES } from "@/lib/marketplace";
import { formatBytes, formatDateTime, formatPrice } from "@/lib/format";
import { signedDownloadUrl } from "@/lib/r2";
import { Decision } from "../../Decision";

export const metadata = { title: "Review product" };

type Props = { params: Promise<{ id: string }> };

const text = (html: string | null) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export default function ReviewProduct({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 560 }} />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: Props) {
  const { id } = await params;
  const { db } = await requireAdmin("review");
  const [{ data: p }, { data: files }, { data: items }] = await Promise.all([
    db.from("products").select("*, creator:profiles!products_creator_id_fkey(full_name)").eq("id", id).maybeSingle(),
    db.from("product_files").select("id, file_key, file_name, file_size, mime_type").eq("product_id", id).order("position"),
    db.from("bundle_items").select("course:courses(title), product:products!bundle_items_product_id_fkey(title)").eq("bundle_id", id).order("position"),
  ]);
  if (!p) notFound();
  const links = new Map(await Promise.all((files ?? []).map(async (f) => [f.id, await signedDownloadUrl(f.file_key, f.file_name, 900)] as const)));
  const isBundle = p.kind === "bundle";

  const checks = [
    { ok: !!p.cover_url, label: "Has a cover image" },
    { ok: text(p.summary).length >= 20, label: "Has a short summary" },
    { ok: text(p.description).length >= 100, label: "Has a description of at least 100 characters" },
    { ok: isBundle ? (items ?? []).length >= 2 : (files ?? []).length > 0, label: isBundle ? "Bundle has at least two items" : "Has files for buyers to download" },
    { ok: p.price_minor === 0 || p.price_minor >= 50_000, label: p.price_minor ? `Price is ${formatPrice(p.price_minor, p.currency)}` : "Free" },
  ];

  return (
    <>
      <Link href="/admin/review?tab=products" className="et-back">
        <ArrowLeft size={14} /> Review queue
      </Link>

      <div className="et-page-head">
        <div>
          <h1>{p.title}</h1>
          <p>
            {ITEM_TYPES[p.kind].label} by <b>{p.creator?.full_name || "Unknown"}</b> · Last updated {formatDateTime(p.updated_at)}
          </p>
        </div>
      </div>

      {p.status !== "pending" && (
        <p className="et-rv-done">
          <ShieldCheck size={15} />
          This product isn&apos;t waiting for review{p.review_note ? `. Last note: "${p.review_note}"` : ""}
        </p>
      )}

      <div className="et-grid-main">
        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <section className="et-card et-card-pad et-rv-overview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.cover_url && <img src={p.cover_url} alt="" className="et-rv-cover" />}
            <dl className="et-rv-facts">
              <div>
                <dt>Price</dt>
                <dd>{p.price_minor ? formatPrice(p.price_minor, p.currency) : "Free"}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{ITEM_TYPES[p.kind].label}</dd>
              </div>
              <div>
                <dt>Formats</dt>
                <dd>{p.formats?.length ? p.formats.join(", ") : "None"}</dd>
              </div>
              <div>
                <dt>{isBundle ? "Items" : "Files"}</dt>
                <dd>{isBundle ? (items ?? []).length : (files ?? []).length}</dd>
              </div>
            </dl>
            {p.summary && <p className="et-rv-summary">{p.summary}</p>}
            {p.description && <p className="et-rv-desc">{text(p.description)}</p>}
            {!!p.gallery?.length && (
              <div className="et-rv-gallery">
                {p.gallery.map((g) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={g} src={g} alt="" />
                ))}
              </div>
            )}
          </section>

          <section className="et-card">
            <div className="et-card-head">
              <h2>{isBundle ? "In this bundle" : "Files buyers get"}</h2>
            </div>
            {isBundle ? (
              <ul className="et-rv-plain">
                {(items ?? []).map((i, n) => (
                  <li key={n}>{i.course?.title ?? i.product?.title ?? "Removed item"}</li>
                ))}
              </ul>
            ) : files?.length ? (
              <div style={{ padding: "4px 20px 16px", display: "grid", gap: 6 }}>
                {files.map((f) => (
                  <a key={f.id} href={links.get(f.id) ?? "#"} className="et-rv-file">
                    <Download size={13} /> {f.file_name} <small>{formatBytes(f.file_size ?? 0)}</small>
                  </a>
                ))}
              </div>
            ) : (
              <p className="et-empty">No files uploaded.</p>
            )}
          </section>
        </div>

        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <section className="et-card et-card-pad">
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>Checklist</h2>
            <ul className="et-rv-checks">
              {checks.map((k) => (
                <li key={k.label} className={k.ok ? "is-ok" : "is-miss"}>
                  {k.ok ? <Check size={14} /> : <X size={14} />} {k.label}
                </li>
              ))}
            </ul>
          </section>
          {p.status === "pending" && <Decision kind="product" id={p.id} ready={checks.every((k) => k.ok)} />}
        </div>
      </div>
    </>
  );
}
