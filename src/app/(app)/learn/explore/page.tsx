import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { MarketCard } from "@/components/market/MarketCard";
import { getExploreItems } from "@/lib/data/marketplace";
import { ITEM_TYPES, type ItemType } from "@/lib/marketplace";

export const metadata = { title: "Explore" };

type Props = { searchParams: Promise<{ q?: string; type?: string }> };
const TYPES = Object.keys(ITEM_TYPES) as ItemType[];

// Explore inside the app: the marketplace (courses, templates, e-books and more) with search and type chips, so the
// Explore tab doesn't leave the app for the public site.
export default function ExploreTab({ searchParams }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: Props) {
  const [{ q = "", type = "" }, items] = await Promise.all([searchParams, getExploreItems()]);
  const term = q.trim().toLowerCase();
  const shown = items.filter(
    (i) =>
      (!type || i.type === type) &&
      (!term || [i.title, i.summary, i.creator, i.category, ...i.tags].some((v) => v?.toLowerCase().includes(term))),
  );
  const href = (t: string) => `/learn/explore?${new URLSearchParams({ ...(q ? { q } : {}), ...(t ? { type: t } : {}) })}`;

  return (
    <>
      <form action="/learn/explore" className="et-mx-search" role="search">
        <Search size={17} />
        <input name="q" defaultValue={q} placeholder="Search courses, templates, e-books" aria-label="Search" enterKeyHint="search" />
        {type && <input type="hidden" name="type" value={type} />}
      </form>
      <nav className="et-mx-chips" aria-label="Type">
        <Link href={href("")} className={!type ? "is-on" : undefined}>
          All
        </Link>
        {TYPES.filter((t) => items.some((i) => i.type === t)).map((t) => (
          <Link key={t} href={href(t)} className={type === t ? "is-on" : undefined}>
            {ITEM_TYPES[t].plural}
          </Link>
        ))}
      </nav>
      {shown.length ? (
        <div className="et-mk-grid">
          {shown.map((i) => (
            <MarketCard key={`${i.type}-${i.id}`} item={i} />
          ))}
        </div>
      ) : (
        <p className="et-card et-card-pad et-muted" style={{ textAlign: "center" }}>
          {term || type ? "Nothing matches. Try another search." : "New courses and products are on the way."}
        </p>
      )}
    </>
  );
}
