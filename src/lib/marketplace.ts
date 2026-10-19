// Shared marketplace labels and helpers (safe for client and server).

export const ITEM_TYPES = {
  course: { label: "Course", plural: "Courses" },
  template: { label: "Template", plural: "Templates" },
  ebook: { label: "E-book", plural: "E-books & guides" },
  resource_pack: { label: "Resource pack", plural: "Resource packs" },
  bundle: { label: "Bundle", plural: "Bundles" },
} as const;

export type ItemType = keyof typeof ITEM_TYPES;
export type ProductKind = Exclude<ItemType, "course">;
export const PRODUCT_KINDS = Object.keys(ITEM_TYPES).filter((k) => k !== "course") as ProductKind[];

// Public address of a marketplace item.
export const itemHref = (type: ItemType, slug: string) => (type === "course" ? `/courses/${slug}` : `/products/${slug}`);

// One card on /explore, whatever it is.
export type ExploreItem = {
  type: ItemType;
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  priceMinor: number;
  compareAtMinor: number | null;
  currency: string;
  creator: string;
  category: string | null;
  categoryId: string | null;
  level: string | null;
  rating: number | null;
  reviews: number;
  // Learners for courses, owners for products.
  popularity: number;
  // Lessons for courses, files for products, items for bundles.
  count: number;
  formats: string[];
  tags: string[];
  featured: boolean;
  publishedAt: string | null;
};
