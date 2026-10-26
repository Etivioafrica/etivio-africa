import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { MarketCard } from "@/components/market/MarketCard";
import { ITEM_TYPES, type ExploreItem, type ItemType } from "@/lib/marketplace";
import { SortSelect } from "./ExploreFilters";

// type and level hold comma-separated lists, so several boxes can be ticked at once.
export type ExploreSearch = { q?: string; type?: string; level?: string; category?: string; price?: string; sort?: string };

const TYPES = Object.keys(ITEM_TYPES) as ItemType[];
const LEVELS = ["beginner", "intermediate", "advanced"];
const list = (v?: string) => (v ? v.split(",").filter(Boolean) : []);

function applyFilters(items: ExploreItem[], s: ExploreSearch) {
  const q = s.q?.trim().toLowerCase();
  const types = list(s.type);
  const levels = list(s.level);
  const out = items.filter(
    (i) =>
      (!types.length || types.includes(i.type)) &&
      (!levels.length || (i.level !== null && levels.includes(i.level))) &&
      (!s.category || i.categoryId === s.category) &&
      (s.price !== "free" || i.priceMinor === 0) &&
      (s.price !== "paid" || i.priceMinor > 0) &&
      (!q || [i.title, i.summary ?? "", i.creator, i.category ?? "", ...i.tags, ...i.formats].join(" ").toLowerCase().includes(q)),
  );
  const by = {
    newest: (a: ExploreItem, b: ExploreItem) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
    rating: (a: ExploreItem, b: ExploreItem) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviews - a.reviews,
    price_low: (a: ExploreItem, b: ExploreItem) => a.priceMinor - b.priceMinor,
    price_high: (a: ExploreItem, b: ExploreItem) => b.priceMinor - a.priceMinor,
    popular: (a: ExploreItem, b: ExploreItem) => Number(b.featured) - Number(a.featured) || b.popularity - a.popularity || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  };
  return [...out].sort(by[(s.sort as keyof typeof by) in by ? (s.sort as keyof typeof by) : "popular"]);
}

// The filter sidebar (type, level), result count, sort and grid. Shared by /explore and the in-app /learn/explore;
// `base` keeps every link on the page it's shown on, `controls` sits beside Sort.
export function ExploreResults({ items, s, base, controls }: { items: ExploreItem[]; s: ExploreSearch; base: string; controls?: ReactNode }) {
  const shown = applyFilters(items, s);
  const filtered = !!(s.q || s.type || s.level || s.category || s.price);
  // Ticks or unticks one value in a comma-separated filter, keeping everything else in the URL.
  const toggle = (key: "type" | "level", value: string) => {
    const current = list(s[key]);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const p = new URLSearchParams(Object.entries({ ...s, [key]: next.join(",") }).filter(([, v]) => v) as [string, string][]);
    return `${base}${p.size ? `?${p}` : ""}`;
  };
  const box = (key: "type" | "level", value: string, label: string, count?: number) => {
    const on = list(s[key]).includes(value);
    return (
      <li key={value}>
        <Link href={toggle(key, value)} className={`et-mk-check${on ? " is-on" : ""}`} role="checkbox" aria-checked={on} scroll={false}>
          <span>{on && <Check size={12} strokeWidth={3} />}</span>
          {label}
          {count !== undefined && <small>{count}</small>}
        </Link>
      </li>
    );
  };

  return (
    <div className="et-mk-layout">
      <aside className="et-mk-side">
        <details className="et-mk-side-filters" open>
          <summary>Filters</summary>
          <h4>Type</h4>
          <ul>{TYPES.map((t) => box("type", t, ITEM_TYPES[t].plural, items.filter((i) => i.type === t).length))}</ul>
          <h4>Level</h4>
          <ul>{LEVELS.map((l) => box("level", l, l.charAt(0).toUpperCase() + l.slice(1)))}</ul>
          {filtered && (
            <Link href={base} className="et-mk-clear">
              Clear all filters
            </Link>
          )}
        </details>
      </aside>

      <div className="et-mk-main">
        <div className="et-mk-head">
          <div className="et-mk-title">
            <h1>{s.q ? `Results for "${s.q}"` : "Explore Etivio"}</h1>
            <p>
              {shown.length} {shown.length === 1 ? "result" : "results"}
              {filtered ? " with your filters" : " across courses, templates, e-books and more"}
            </p>
          </div>
          <div className="et-mk-controls">
            {controls}
            <SortSelect base={base} />
          </div>
        </div>
        {shown.length ? (
          <div className="et-mk-grid">
            {shown.map((i) => (
              <MarketCard key={`${i.type}-${i.id}`} item={i} />
            ))}
          </div>
        ) : (
          <div className="et-mk-empty">
            <b>Nothing here yet</b>
            <p>{filtered ? "Try a different search or fewer filters." : "New courses and products are on the way."}</p>
            {filtered && (
              <Link href={base} className="et-btn et-btn-ghost">
                See everything
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
