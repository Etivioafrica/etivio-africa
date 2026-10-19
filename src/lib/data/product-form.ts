import "server-only";
import type { loadProductForEdit, ProductInput } from "./products-admin";

// Database row → the editor's form values.
export function toFormValues(loaded: NonNullable<Awaited<ReturnType<typeof loadProductForEdit>>>): Omit<ProductInput, "intent"> & { id: string } {
  const p = loaded.product;
  const naira = (m: number | null) => (m ? String(m / 100) : "");
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    slug: p.slug,
    summary: p.summary ?? "",
    description: p.description ?? "",
    coverUrl: p.cover_url ?? "",
    gallery: p.gallery,
    priceNaira: naira(p.price_minor),
    compareAtNaira: naira(p.compare_at_minor),
    categoryId: p.category_id ?? "",
    formats: p.formats.join(", "),
    tags: p.tags.join(", "),
    featured: p.featured,
    files: loaded.files,
    bundle: loaded.bundle,
  };
}
