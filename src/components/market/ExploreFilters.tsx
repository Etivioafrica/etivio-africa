"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, LayoutGrid, Search, Tag } from "lucide-react";
import { Select } from "@/components/dash/Select";

type Option = { id: string; name: string };

// Keeps every filter in the URL so filtered views can be shared. `base` is the page the filters live on:
// /explore on the public site, /learn/explore inside the app.
function useSetParam(base: string) {
  const router = useRouter();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${base}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  return { params, set };
}

function CategoryOptions({ categories }: { categories: Option[] }) {
  return (
    <>
      <option value="">All categories</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </>
  );
}

function PriceOptions() {
  return (
    <>
      <option value="">Any price</option>
      <option value="free">Free</option>
      <option value="paid">Paid</option>
    </>
  );
}

// The dark filter bar on /explore: search, category and price.
export function ExploreFilters({ categories, base = "/explore" }: { categories: Option[]; base?: string }) {
  const { params, set } = useSetParam(base);
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
          <CategoryOptions categories={categories} />
        </Select>
      </div>
      <div className="et-mk-seg">
        <span className="et-mk-seg-icon">
          <Tag size={16} />
        </span>
        <Select className="et-select" value={params.get("price") ?? ""} onChange={(e) => set("price", e.target.value)} aria-label="Price">
          <PriceOptions />
        </Select>
      </div>
    </div>
  );
}

// Inside the app: the search box on its own (filters stay in the URL), then category and price as pills.
export function AppExploreSearch({ base }: { base: string }) {
  const { params, set } = useSetParam(base);
  return (
    <form
      className="et-mx-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        set("q", String(new FormData(e.currentTarget).get("q") ?? "").trim());
      }}
    >
      <Search size={17} />
      <input name="q" defaultValue={params.get("q") ?? ""} placeholder="Search courses, templates, e-books" aria-label="Search" enterKeyHint="search" />
    </form>
  );
}

export function AppExploreFilters({ categories, base }: { categories: Option[]; base: string }) {
  const { params, set } = useSetParam(base);
  return (
    <>
      <label className="et-mk-sort">
        <LayoutGrid size={15} />
        <Select className="et-select" value={params.get("category") ?? ""} onChange={(e) => set("category", e.target.value)} aria-label="Category">
          <CategoryOptions categories={categories} />
        </Select>
      </label>
      <label className="et-mk-sort">
        <Tag size={15} />
        <Select className="et-select" value={params.get("price") ?? ""} onChange={(e) => set("price", e.target.value)} aria-label="Price">
          <PriceOptions />
        </Select>
      </label>
    </>
  );
}

export function SortSelect({ base = "/explore" }: { base?: string }) {
  const { params, set } = useSetParam(base);
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
