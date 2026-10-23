"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, LayoutGrid, Search, Tag } from "lucide-react";
import { Select } from "@/components/dash/Select";

type Option = { id: string; name: string };

// Keeps every filter in the URL so filtered views can be shared.
function useSetParam() {
  const router = useRouter();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/explore${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  return { params, set };
}

// The dark filter bar on /explore: search, category and price.
export function ExploreFilters({ categories }: { categories: Option[] }) {
  const { params, set } = useSetParam();
  return (
    <div className="et-mk-bar">
      <form
        className="et-mk-seg is-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          set("q", String(new FormData(e.currentTarget).get("q") ?? "").trim());
        }}
      >
        <Search size={17} />
        <input name="q" defaultValue={params.get("q") ?? ""} placeholder="Search courses, templates, e-books…" aria-label="Search the marketplace" />
        <button type="submit">Search</button>
      </form>
      <div className="et-mk-seg">
        <span className="et-mk-seg-icon">
          <LayoutGrid size={16} />
        </span>
        <Select className="et-select" value={params.get("category") ?? ""} onChange={(e) => set("category", e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="et-mk-seg">
        <span className="et-mk-seg-icon">
          <Tag size={16} />
        </span>
        <Select className="et-select" value={params.get("price") ?? ""} onChange={(e) => set("price", e.target.value)} aria-label="Price">
          <option value="">Any price</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </Select>
      </div>
    </div>
  );
}

export function SortSelect() {
  const { params, set } = useSetParam();
  return (
    <label className="et-mk-sort">
      <ArrowUpDown size={15} />
      <span>Sort</span>
      <Select className="et-select" value={params.get("sort") ?? ""} onChange={(e) => set("sort", e.target.value)} aria-label="Sort by">
        <option value="">Most popular</option>
        <option value="newest">Newest</option>
        <option value="rating">Highest rated</option>
        <option value="price_low">Price: low to high</option>
        <option value="price_high">Price: high to low</option>
      </Select>
    </label>
  );
}
