import { Suspense } from "react";
import type { Metadata } from "next";
import { ExploreFilters } from "@/components/market/ExploreFilters";
import { ExploreResults, type ExploreSearch } from "@/components/market/ExploreResults";
import { getCategories, getExploreItems } from "@/lib/data/marketplace";

export const metadata: Metadata = {
  title: "Explore courses, templates and more | Etivio",
  description: "Practical courses, templates, e-books and resource packs from creators across Africa.",
  alternates: { canonical: "/explore" },
};

type Props = { searchParams: Promise<ExploreSearch> };

export default function ExplorePage({ searchParams }: Props) {
  return (
    <div className="et-mk">
      <section className="et-mk-hero">
        <div className="et-mk-hero-in">
          <Suspense fallback={<div className="et-mk-bar" />}>
            <Bar searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Bar({ searchParams }: Props) {
  const s = await searchParams;
  const categories = await getCategories();
  return <ExploreFilters key={s.q ?? ""} categories={categories.filter((c) => !c.parent_id)} />;
}

async function Results({ searchParams }: Props) {
  const [s, items] = await Promise.all([searchParams, getExploreItems()]);
  return <ExploreResults items={items} s={s} base="/explore" />;
}
