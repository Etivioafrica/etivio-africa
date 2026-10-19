import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketCard } from "@/components/market/MarketCard";
import { getCategories, getExploreItems } from "@/lib/data/marketplace";
import { ITEM_TYPES, type ExploreItem, type ItemType } from "@/lib/marketplace";
import { ExploreFilters } from "./ExploreFilters";

export const metadata: Metadata = {
  title: "Explore courses, templates and more | Etivio",
  description: "Practical courses, templates, e-books and resource packs from creators across Africa.",
  alternates: { canonical: "/explore" },
};

type Search = { q?: string; type?: string; category?: string; price?: string; sort?: string };
type Props = { searchParams: Promise<Search> };

const TYPES = Object.keys(ITEM_TYPES) as ItemType[];

function applyFilters(items: ExploreItem[], s: Search) {
  const q = s.q?.trim().toLowerCase();
  let out = items.filter(
    (i) =>
      (!s.type || i.type === s.type) &&
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
  out = [...out].sort(by[(s.sort as keyof typeof by) in by ? (s.sort as keyof typeof by) : "popular"]);
  return out;
}

export default function ExplorePage({ searchParams }: Props) {
  return (
    <div className="et-mk">
      <section className="et-mk-hero">
        <h1>Explore Etivio</h1>
        <p>Courses, templates, e-books and resource packs from creators across Africa.</p>
      </section>
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: Props) {
  const s = await searchParams;
  const [items, categories] = await Promise.all([getExploreItems(), getCategories()]);
  const shown = applyFilters(items, s);
  const counts = new Map(TYPES.map((t) => [t, items.filter((i) => i.type === t).length]));
  const link = (type?: string) => {
    const p = new URLSearchParams(Object.entries({ ...s, type }).filter(([, v]) => v) as [string, string][]);
    return `/explore${p.size ? `?${p}` : ""}`;
  };
  const filtered = !!(s.q || s.type || s.category || s.price);

  return (
    <>
      <ExploreFilters key={s.q ?? ""} categories={categories.filter((c) => !c.parent_id)} />
      <nav className="et-mk-tabs" aria-label="Type">
        <Link href={link(undefined)} className={!s.type ? "is-on" : ""}>
          All <small>{items.length}</small>
        </Link>
        {TYPES.map((t) => (
          <Link key={t} href={link(t)} className={s.type === t ? "is-on" : ""}>
            {ITEM_TYPES[t].plural} <small>{counts.get(t)}</small>
          </Link>
        ))}
      </nav>
      <p className="et-mk-count">
        {shown.length} {shown.length === 1 ? "result" : "results"}
        {s.q ? ` for "${s.q}"` : ""}
        {filtered && (
          <>
            {" · "}
            <Link href="/explore">Clear filters</Link>
          </>
        )}
      </p>
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
            <Link href="/explore" className="et-btn et-btn-ghost">
              See everything
            </Link>
          )}
        </div>
      )}
    </>
  );
}
