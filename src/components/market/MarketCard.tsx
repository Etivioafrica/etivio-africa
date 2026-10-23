import Link from "next/link";
import { BookOpen, FileText, Layers, LayoutTemplate, Package, Star } from "lucide-react";
import { ITEM_TYPES, itemHref, type ExploreItem, type ItemType } from "@/lib/marketplace";
import { defaultAvatar } from "@/lib/avatars";
import { formatPrice } from "@/lib/format";

const ICONS: Record<ItemType, typeof BookOpen> = { course: BookOpen, template: LayoutTemplate, ebook: FileText, resource_pack: Package, bundle: Layers };

// Solid pastel panels, picked from the title so a card keeps its colour.
const PANELS = ["#fde3cf", "#d5f2e6", "#e4dcfb", "#d8ecfb", "#fbdcec", "#e9edf3", "#f3f0c9", "#dbe6fb"];
function panel(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return PANELS[Math.abs(h) % PANELS.length];
}

function countLabel(i: ExploreItem) {
  if (i.type === "course") return `${i.count} ${i.count === 1 ? "lesson" : "lessons"}`;
  if (i.type === "bundle") return `${i.count} ${i.count === 1 ? "item" : "items"}`;
  return i.formats.length ? i.formats.slice(0, 2).join(", ") : `${i.count} ${i.count === 1 ? "file" : "files"}`;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// One marketplace tile: a coloured panel (date, creator, title, tags), then price and a Details button.
export function MarketCard({ item }: { item: ExploreItem }) {
  const Icon = ICONS[item.type];
  const tags = [ITEM_TYPES[item.type].label, item.level && item.level.charAt(0).toUpperCase() + item.level.slice(1), countLabel(item), item.category].filter(Boolean) as string[];
  return (
    <article className="et-mk-card">
      <Link href={itemHref(item.type, item.slug)} className="et-mk-link" aria-label={item.title} />
      <div className="et-mk-panel" style={{ background: panel(item.title) }}>
        <div className="et-mk-top">
          <span className="et-mk-date">{item.featured ? "Featured" : item.publishedAt ? day(item.publishedAt) : "New"}</span>
          <span className="et-mk-type" title={ITEM_TYPES[item.type].label}>
            <Icon size={14} />
          </span>
        </div>
        <div className="et-mk-titlerow">
          <div>
            <small>{item.creator}</small>
            <h3>{item.title}</h3>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={`et-mk-face${item.creatorAvatar ? " is-photo" : ""}`} src={item.creatorAvatar ?? defaultAvatar(item.creator)} alt="" loading="lazy" />
        </div>
        <ul className="et-mk-tags">
          {tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <div className="et-mk-foot">
        <div>
          <b>
            {item.priceMinor === 0 ? "Free" : formatPrice(item.priceMinor, item.currency)}
            {item.compareAtMinor && item.compareAtMinor > item.priceMinor ? <s>{formatPrice(item.compareAtMinor, item.currency)}</s> : null}
          </b>
          <small>
            {item.rating !== null ? (
              <>
                <Star size={11} fill="currentColor" className="et-mk-star" /> {item.rating.toFixed(1)} ({item.reviews.toLocaleString()})
              </>
            ) : item.popularity > 0 ? (
              `${item.popularity.toLocaleString()} ${item.type === "course" ? "learners" : "owners"}`
            ) : (
              "Just added"
            )}
          </small>
        </div>
        <span className="et-mk-details">Details</span>
      </div>
    </article>
  );
}
