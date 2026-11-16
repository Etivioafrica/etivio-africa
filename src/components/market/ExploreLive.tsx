"use client";
import { useSearchParams } from "next/navigation";
import type { ExploreItem } from "@/lib/marketplace";
import { ExploreResults, type ExploreSearch } from "./ExploreResults";
import { ExploreFilters } from "./ExploreFilters";

// The search bar, reset whenever the search text in the URL changes (e.g. a new search from the header).
export function ExploreFiltersLive({ categories }: { categories: { id: string; name: string }[] }) {
  const q = useSearchParams().get("q") ?? "";
  return <ExploreFilters key={q} categories={categories} />;
}

// Reads the filters from the URL in the browser, so /explore is prerendered once and served from the CDN instead of
// running a function for every filter combination a crawler (or person) tries. Render inside a <Suspense> whose
// fallback is the unfiltered list, so the HTML search engines see still has every item.
export function ExploreResultsLive({ items, base }: { items: ExploreItem[]; base: string }) {
  const params = useSearchParams();
  const s = Object.fromEntries(params.entries()) as ExploreSearch;
  return <ExploreResults items={items} s={s} base={base} />;
}
