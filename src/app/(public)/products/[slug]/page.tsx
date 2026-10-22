import { Suspense } from "react";
import { JsonLd, breadcrumbs, product as seoProduct } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, ChevronRight, Download, FileText, Heart, Infinity as Lifetime, Layers, LayoutTemplate, Package, RefreshCw, ShieldCheck, Star, Users } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { ShareButton } from "@/components/dash/ShareButton";
import { getPublicProduct, itemMeta, type PublicProduct } from "@/lib/data/marketplace";
import { ITEM_TYPES, itemHref, type ItemType } from "@/lib/marketplace";
import { formatBytes, formatDate, formatPrice } from "@/lib/format";
import { sanitizeRichText } from "@/lib/sanitize";
import { claimFreeProduct, toggleSavedProduct } from "../actions";
import { PaymentNotice } from "@/components/market/PaymentNotice";
import { AddToCart } from "@/components/market/AddToCart";
import { ReviewCard } from "@/components/learn/ReviewCard";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = await itemMeta("product", slug);
  if (!meta) return { title: "Not found | Etivio", robots: { index: false } };
  const description = meta.summary || `${meta.title} on Etivio.`;
  return {
    title: `${meta.title} | Etivio`,
    description,
    alternates: { canonical: `/products/${slug}` },
    openGraph: { type: "website", siteName: "Etivio", title: meta.title, description, images: meta.cover ? [meta.cover] : undefined },
    twitter: { card: meta.cover ? "summary_large_image" : "summary", title: meta.title, description },
  };
}

export default function ProductPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 640 }} />}>
      <Product params={params} />
    </Suspense>
  );
}

const ICONS: Record<ItemType, typeof BookOpen> = { course: BookOpen, template: LayoutTemplate, ebook: FileText, resource_pack: Package, bundle: Layers };
const monthYear = (d: string) => new Date(d).toLocaleDateString("en-GB", { month: "numeric", year: "numeric" });
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="et-ud-stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}
const ext = (name: string) => (name.includes(".") ? name.split(".").pop()!.toUpperCase().slice(0, 5) : "FILE");

async function Product({ params }: Props) {
  const data = await getPublicProduct((await params).slug);
  if (!data) notFound();
  const { product: p, creator, rating, reviewCount } = data;
  return (
    <>
      <JsonLd
        data={[
          seoProduct({ ...p, creator: creator.name, rating, reviews: reviewCount }),
          breadcrumbs([
            { name: "Explore", path: "/explore" },
            { name: ITEM_TYPES[p.kind].plural, path: `/explore?type=${p.kind}` },
            { name: p.title, path: `/products/${p.slug}` },
          ]),
        ]}
      />
      <ProductView data={data} />
    </>
  );
}

function ProductView({ data }: { data: PublicProduct }) {
  const { product: p, creator, files, bundle, owners, owned, saved, signedIn, rating, reviews, reviewCount, review } = data;
  const Icon = ICONS[p.kind];
  const free = p.priceMinor === 0;
  const path = `/products/${p.slug}`;
  const description = p.description ? sanitizeRichText(p.description) : "";
  const bundleValue = bundle.reduce((n, b) => n + b.priceMinor, 0);
  const discount = p.compareAtMinor && p.compareAtMinor > p.priceMinor ? Math.round((1 - p.priceMinor / p.compareAtMinor) * 100) : 0;

  const cta = owned ? (
    <Link href="/learn/library" className="et-btn et-btn-primary et-ud-cta">
      <Download size={16} /> {p.kind === "bundle" ? "Open in your library" : "Download"}
    </Link>
  ) : !free ? (
    <AddToCart item={{ type: "product", id: p.id, slug: p.slug, title: p.title, kind: p.kind, priceMinor: p.priceMinor, currency: p.currency, coverUrl: p.coverUrl }} />
  ) : !signedIn ? (
    <Link href={`/signup?next=${encodeURIComponent(path)}`} className="et-btn et-btn-primary et-ud-cta">
      Sign up to get it free
    </Link>
  ) : (
    <form action={claimFreeProduct}>
      <input type="hidden" name="slug" value={p.slug} />
      <button type="submit" className="et-btn et-btn-primary et-ud-cta">
        Get it free
      </button>
    </form>
  );

  return (
    <div className="et-ud">
      <Suspense fallback={null}>
        <PaymentNotice />
      </Suspense>
      <section className="et-ud-hero">
        <div className="et-ud-grid">
          <div className="et-ud-hero-text">
            <nav className="et-ud-crumb" aria-label="Breadcrumb">
              <Link href="/explore">Explore</Link>
              <ChevronRight size={14} />
              <Link href={`/explore?type=${p.kind}`}>{ITEM_TYPES[p.kind].plural}</Link>
              {p.category && (
                <>
                  <ChevronRight size={14} />
                  <Link href={`/explore?type=${p.kind}&q=${encodeURIComponent(p.category)}`}>{p.category}</Link>
                </>
              )}
            </nav>
            <h1>{p.title}</h1>
            {p.summary && <p className="et-ud-sub">{p.summary}</p>}
            <div className="et-ud-badges">
              <span className="et-ud-badge is-blue">
                {ITEM_TYPES[p.kind].label}
              </span>
              {p.featured && <span className="et-ud-badge is-amber">Featured</span>}
              {discount > 0 && <span className="et-ud-badge is-green">Save {discount}%</span>}
            </div>
            {rating !== null && (
              <p className="et-ud-rating">
                <b>{rating.toFixed(1)}</b>
                <Stars value={rating} />
                <a href="#reviews">({plural(reviewCount, "rating")})</a>
              </p>
            )}
            <p className="et-ud-by">
              Created by <a href="#creator">{creator.name}</a>
            </p>
            <p className="et-ud-meta">
              {p.publishedAt && (
                <span>
                  <CalendarDays size={15} /> Updated {monthYear(p.updatedAt)}
                </span>
              )}
              {p.formats.length > 0 && (
                <span>
                  <Icon size={15} /> {p.formats.join(", ")}
                </span>
              )}
              <span>
                <Users size={15} /> {owners.toLocaleString()} {owners === 1 ? "owner" : "owners"}
              </span>
            </p>
          </div>

          <div className="et-ud-side-slot">
            <aside className="et-ud-card">
              <div className="et-ud-preview">
                <div className="et-cover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.coverUrl ? <img src={p.coverUrl} alt="" /> : <Icon size={40} strokeWidth={1.5} />}
                </div>
              </div>
              <div className="et-ud-card-body">
                <p className="et-ud-price">
                  {free ? "Free" : formatPrice(p.priceMinor, p.currency)}
                  {p.compareAtMinor && p.compareAtMinor > p.priceMinor ? <s className="et-pd-was">{formatPrice(p.compareAtMinor, p.currency)}</s> : null}
                </p>
                {cta}
                {signedIn && !owned && (
                  <form action={toggleSavedProduct}>
                    <input type="hidden" name="slug" value={p.slug} />
                    <input type="hidden" name="saved" value={saved ? "1" : "0"} />
                    <button type="submit" className={`et-btn et-ud-cta et-ud-outline${saved ? " is-saved" : ""}`} aria-pressed={saved}>
                      <Heart size={16} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved for later" : "Save for later"}
                    </button>
                  </form>
                )}
                <ul className="et-ud-perks">
                  {p.kind === "bundle" ? (
                    <li>
                      <Layers size={16} /> {bundle.length} {bundle.length === 1 ? "item" : "items"} included
                    </li>
                  ) : (
                    <li>
                      <Download size={16} /> {files.length} downloadable {files.length === 1 ? "file" : "files"}
                    </li>
                  )}
                  <li>
                    <Lifetime size={16} /> Yours to keep, with lifetime access
                  </li>
                  <li>
                    <RefreshCw size={16} /> Free updates when the creator improves it
                  </li>
                  <li>
                    <ShieldCheck size={16} /> Secure download from your library
                  </li>
                </ul>
              </div>
              <div className="et-ud-card-foot">
                <ShareButton title={p.title} path={path} className="et-ud-share" />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <div className="et-ud-grid et-ud-body et-pd-body">
        <div className="et-ud-main">
          {p.gallery.length > 0 && (
            <section className="et-pd-gallery" aria-label="Preview images">
              {p.gallery.map((src) => (
                <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" />
                </a>
              ))}
            </section>
          )}

          {p.kind === "bundle" ? (
            <section className="et-ud-box">
              <h2>What&apos;s in this bundle</h2>
              <ul className="et-pd-bundle">
                {bundle.map((b) => {
                  const BIcon = ICONS[b.type];
                  return (
                    <li key={`${b.type}-${b.slug}`}>
                      <span className="et-pd-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {b.coverUrl ? <img src={b.coverUrl} alt="" /> : <BIcon size={18} />}
                      </span>
                      <div>
                        <Link href={itemHref(b.type, b.slug)}>{b.title}</Link>
                        <small>{ITEM_TYPES[b.type].label}</small>
                      </div>
                      <s>{b.priceMinor ? formatPrice(b.priceMinor, b.currency) : "Free"}</s>
                    </li>
                  );
                })}
              </ul>
              {bundleValue > p.priceMinor && (
                <p className="et-pd-value">
                  Worth {formatPrice(bundleValue, p.currency)} separately. You save {formatPrice(bundleValue - p.priceMinor, p.currency)}.
                </p>
              )}
            </section>
          ) : (
            files.length > 0 && (
              <section className="et-ud-box">
                <h2>What you&apos;ll get</h2>
                <ul className="et-pd-files">
                  {files.map((f) => (
                    <li key={f.id}>
                      <span className="et-pd-ext">{ext(f.name)}</span>
                      <b>{f.name}</b>
                      {f.size ? <small>{formatBytes(f.size)}</small> : null}
                    </li>
                  ))}
                </ul>
              </section>
            )
          )}

          {description && (
            <section className="et-ud-section">
              <h2>Description</h2>
              <div className="et-rich et-pd-desc" dangerouslySetInnerHTML={{ __html: description }} />
            </section>
          )}

          {p.tags.length > 0 && (
            <section className="et-ud-section">
              <h2>Tags</h2>
              <p className="et-pd-tags">
                {p.tags.map((t) => (
                  <Link key={t} href={`/explore?q=${encodeURIComponent(t)}`}>
                    {t}
                  </Link>
                ))}
              </p>
            </section>
          )}

          {review.canReview && <ReviewCard courseId={p.id} canReview mine={review.mine} kind="product" />}

          {reviews.length > 0 && (
            <section className="et-ud-section" id="reviews">
              <h2 className="et-ud-rating-head">
                <Star size={20} fill="currentColor" /> {rating?.toFixed(1)} product rating · {plural(reviewCount, "rating")}
              </h2>
              <div className="et-cd-reviews">
                {reviews.map((r) => (
                  <article key={r.id}>
                    <div className="et-cd-review-head">
                      <Avatar src={r.avatar} initial={r.author.charAt(0).toUpperCase()} className="et-cd-avatar is-sm" />
                      <div>
                        <b>{r.author}</b>
                        <span className="et-cd-stars">
                          <Stars value={r.rating} size={12} />
                          <small>{formatDate(r.at)}</small>
                        </span>
                      </div>
                    </div>
                    {r.body && <p>{r.body}</p>}
                    {r.reply && (
                      <p className="et-cd-reply">
                        <b>Reply from Etivio:</b> {r.reply}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="et-ud-section" id="creator">
            <h2>Creator</h2>
            <div className="et-cd-instructor">
              <Avatar src={creator.avatar} initial={creator.name.charAt(0).toUpperCase()} className="et-cd-avatar" />
              <div>
                {creator.profile ? (
                  <Link href={creator.profile} className="et-ud-inst-name">
                    {creator.name}
                  </Link>
                ) : (
                  <b className="et-ud-inst-name">{creator.name}</b>
                )}
                {creator.headline && <small>{creator.headline}</small>}
              </div>
            </div>
            {creator.bio && <p className="et-cd-about">{creator.bio}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
