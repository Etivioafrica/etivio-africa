"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

// Search box and dropdowns for /explore. Everything is kept in the URL so filtered views can be shared.
export function ExploreFilters({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/explore${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="et-mk-filters">
      <form
        className="et-mk-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          set("q", String(new FormData(e.currentTarget).get("q") ?? "").trim());
        }}
      >
        <Search size={18} />
        <input name="q" defaultValue={params.get("q") ?? ""} placeholder="Search courses, templates, e-books…" aria-label="Search the marketplace" />
        <button type="submit" className="et-btn et-btn-primary et-btn-sm">
          Search
        </button>
      </form>
      <div className="et-mk-selects">
        <select className="et-select" value={params.get("category") ?? ""} onChange={(e) => set("category", e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="et-select" value={params.get("price") ?? ""} onChange={(e) => set("price", e.target.value)} aria-label="Price">
          <option value="">Any price</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
        <select className="et-select" value={params.get("sort") ?? ""} onChange={(e) => set("sort", e.target.value)} aria-label="Sort by">
          <option value="">Most popular</option>
          <option value="newest">Newest</option>
          <option value="rating">Highest rated</option>
          <option value="price_low">Price: low to high</option>
          <option value="price_high">Price: high to low</option>
        </select>
      </div>
    </div>
  );
}
