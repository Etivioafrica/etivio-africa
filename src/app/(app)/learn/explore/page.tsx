import { Suspense } from "react";
import { AppExploreFilters, AppExploreSearch } from "@/components/market/ExploreFilters";
import { ExploreResults, type ExploreSearch } from "@/components/market/ExploreResults";
import { getCategories, getExploreItems } from "@/lib/data/marketplace";

export const metadata = { title: "Explore" };

type Props = { searchParams: Promise<ExploreSearch> };
const BASE = "/learn/explore";

// Explore inside the app: the marketplace with the same filters as the public /explore (type, level, category,
// price, sort), so the Marketplace link doesn't leave the app for the public site.
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
  const [s, items, categories] = await Promise.all([searchParams, getExploreItems(), getCategories()]);
  return (
    <>
      <AppExploreSearch key={s.q ?? ""} base={BASE} />
      <ExploreResults
        items={items}
        s={s}
        base={BASE}
        controls={<AppExploreFilters categories={categories.filter((c) => !c.parent_id)} base={BASE} />}
      />
    </>
  );
}
