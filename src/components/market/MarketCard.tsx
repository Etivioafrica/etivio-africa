import Link from "next/link";
import { BookOpen, FileText, Layers, LayoutTemplate, Package, Star } from "lucide-react";
import { ITEM_TYPES, itemHref, type ExploreItem, type ItemType } from "@/lib/marketplace";
import { formatPrice } from "@/lib/format";

const ICONS: Record<ItemType, typeof BookOpen> = { course: BookOpen, template: LayoutTemplate, ebook: FileText, resource_pack: Package, bundle: Layers };

function countLabel(i: ExploreItem) {
  if (i.type === "course") return `${i.count} ${i.count === 1 ? "lesson" : "lessons"}`;
  if (i.type === "bundle") return `${i.count} ${i.count === 1 ? "item" : "items"}`;
  return i.formats.length ? i.formats.slice(0, 2).join(", ") : `${i.count} ${i.count === 1 ? "file" : "files"}`;
}

// One marketplace tile: cover, type, title, creator, rating or details, price.
export function MarketCard({ item }: { item: ExploreItem }) {
  const Icon = ICONS[item.type];
  return (
    <article className="et-mk-card">
      <Link href={itemHref(item.type, item.slug)} className="et-mk-link" aria-label={item.title} />
      <div className="et-mk-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" /> : <Icon size={34} strokeWidth={1.5} />}
        <span className="et-mk-type">
          <Icon size={12} /> {ITEM_TYPES[item.type].label}
        </span>
      </div>
      <div className="et-mk-body">
        <h3>{item.title}</h3>
        <p className="et-mk-by">{item.creator}</p>
        {item.rating !== null ? (
          <p className="et-mk-rating">
            <b>{item.rating.toFixed(1)}</b>
            <span className="et-ud-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={12} fill={n <= Math.round(item.rating!) ? "currentColor" : "none"} />
              ))}
            </span>
            <small>({item.reviews.toLocaleString()})</small>
          </p>
        ) : (
          <p className="et-mk-meta">
            {countLabel(item)}
            {item.level ? <span className="et-cap"> · {item.level}</span> : null}
          </p>
        )}
        <p className="et-mk-price">
          <b>{item.priceMinor === 0 ? "Free" : formatPrice(item.priceMinor, item.currency)}</b>
          {item.compareAtMinor && item.compareAtMinor > item.priceMinor ? <s>{formatPrice(item.compareAtMinor, item.currency)}</s> : null}
        </p>
        {(item.featured || item.popularity >= 50) && <span className="et-mk-flag">{item.featured ? "Featured" : "Popular"}</span>}
      </div>
    </article>
  );
}
