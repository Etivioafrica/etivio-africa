import { Suspense } from "react";
import type { Metadata } from "next";
import { ExploreResults } from "@/components/market/ExploreResults";
import { ExploreFiltersLive, ExploreResultsLive } from "@/components/market/ExploreLive";
import { getCategories, getExploreItems } from "@/lib/data/marketplace";

export const metadata: Metadata = {
  title: "Explore courses, templates and more | Etivio",
  description: "Practical courses, templates, e-books and resource packs from creators across Africa.",
  alternates: { canonical: "/explore" },
};

// Fully prerendered: the item list comes from a cache, and filtering happens in the browser from the URL, so
// visitors and crawlers trying filter combinations are served from the CDN instead of running a function each time.
export default function ExplorePage() {
  return (
    <div className="et-mk">
      <section className="et-mk-hero">
        <div className="et-mk-hero-in">
          <Suspense fallback={<div className="et-mk-bar" />}>
            <Bar />
          </Suspense>
        </div>
      </section>
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Results />
      </Suspense>
    </div>
  );
}

async function Bar() {
  const categories = await getCategories();
  return (
    <Suspense fallback={<div className="et-mk-bar" />}>
      <ExploreFiltersLive categories={categories.filter((c) => !c.parent_id)} />
    </Suspense>
  );
}

async function Results() {
  const items = await getExploreItems();
  // The unfiltered list is the prerendered HTML; the browser swaps in the filtered view from the URL.
  return (
    <Suspense fallback={<ExploreResults items={items} s={{}} base="/explore" />}>
      <ExploreResultsLive items={items} base="/explore" />
    </Suspense>
  );
}
