import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailProductSubmitted } from "@/lib/email/notify";
import { deleteObject, keyFromUrl, publicUrl } from "@/lib/r2";
import { nairaToMinor, slugify } from "@/lib/format";
import { sanitizeRichText } from "@/lib/sanitize";
import { PRODUCT_KINDS, type ProductKind } from "@/lib/marketplace";

// Saving marketplace products, shared by Admin → Marketplace and the tutor's Teach → Products. Admins publish
// directly; tutors submit for review, and editing a live product sends it back for review.

export type ProductFileInput = { id?: string; url: string; key: string; name: string; size: number; type: string };
export type ProductInput = {
  id?: string;
  kind: ProductKind;
  title: string;
  slug: string;
  summary: string;
  description: string;
  coverUrl: string;
  gallery: string[];
  priceNaira: string;
  compareAtNaira: string;
  categoryId: string;
  formats: string;
  tags: string;
  featured: boolean;
  files: ProductFileInput[];
  bundle: { type: "course" | "product"; id: string }[];
  // draft: keep as a draft. publish: admins only. submit: tutors send it for review.
  intent: "draft" | "publish" | "submit";
};
export type Actor = { id: string; isAdmin: boolean };
type Result = { ok?: string; error?: string; id?: string; slug?: string };

const list = (s: string, max: number) => [...new Set(s.split(",").map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, max);
const isR2 = (url: string) => !!keyFromUrl(url);

export async function saveProduct(actor: Actor, input: ProductInput): Promise<Result> {
  const db = createAdminClient();
  const title = input.title.trim().slice(0, 140);
  if (title.length < 3) return { error: "Give it a title of at least 3 characters." };
  if (!PRODUCT_KINDS.includes(input.kind)) return { error: "Pick what kind of product this is." };
  const price = nairaToMinor(input.priceNaira || "0");
  const compareAt = input.compareAtNaira.trim() ? nairaToMinor(input.compareAtNaira) : null;
  if (price > 0 && price < 10000) return { error: "Paid items need a price of at least ₦100." };
  if (compareAt !== null && compareAt <= price) return { error: "The \"was\" price must be higher than the price." };
  const files = input.kind === "bundle" ? [] : input.files.filter((f) => keyFromUrl(f.url)?.startsWith("products/")).slice(0, 30);
  const bundle = input.kind === "bundle" ? input.bundle.slice(0, 40) : [];
  const publishing = input.intent === "publish" || input.intent === "submit";
  if (publishing && input.kind !== "bundle" && !files.length) return { error: "Add at least one file before publishing." };
  if (publishing && input.kind === "bundle" && bundle.length < 2) return { error: "A bundle needs at least two items." };
  if (publishing && !input.coverUrl) return { error: "Add a cover image before publishing." };
  if (input.intent === "publish" && !actor.isAdmin) return { error: "Only admins can publish directly. Submit it for review instead." };

  const before = input.id ? (await db.from("products").select("id, creator_id, slug, status, cover_url, gallery, published_at").eq("id", input.id).maybeSingle()).data : null;
  if (input.id && !before) return { error: "That product no longer exists." };
  if (before && !actor.isAdmin && before.creator_id !== actor.id) return { error: "You can only edit your own products." };

  // Tutors can only bundle their own courses and products.
  if (bundle.length && !actor.isAdmin) {
    const courseIds = bundle.filter((b) => b.type === "course").map((b) => b.id);
    const productIds = bundle.filter((b) => b.type === "product").map((b) => b.id);
    const [{ count: theirCourses }, { count: theirProducts }] = await Promise.all([
      courseIds.length ? db.from("courses").select("id", { count: "exact", head: true }).in("id", courseIds).eq("instructor_id", actor.id) : Promise.resolve({ count: 0 }),
      productIds.length ? db.from("products").select("id", { count: "exact", head: true }).in("id", productIds).eq("creator_id", actor.id) : Promise.resolve({ count: 0 }),
    ]);
    if ((theirCourses ?? 0) !== courseIds.length || (theirProducts ?? 0) !== productIds.length) return { error: "Bundles can only include your own courses and products." };
  }

  const status =
    input.intent === "publish"
      ? "published"
      : input.intent === "submit"
        ? "pending"
        : !actor.isAdmin && before?.status === "published"
          ? "pending"
          : before && input.intent === "draft" && before.status === "published" && actor.isAdmin
            ? "published"
            : "draft";

  const { data: cat } = input.categoryId ? await db.from("course_categories").select("id").eq("id", input.categoryId).maybeSingle() : { data: null };
  const fields = {
    kind: input.kind,
    title,
    summary: input.summary.trim().slice(0, 300) || null,
    description: sanitizeRichText(input.description || "").replace(/<p><\/p>/g, "").trim() || null,
    cover_url: input.coverUrl && isR2(input.coverUrl) ? input.coverUrl : null,
    gallery: input.gallery.filter(isR2).slice(0, 12),
    price_minor: price,
    compare_at_minor: compareAt,
    category_id: cat?.id ?? null,
    formats: list(input.formats, 8),
    tags: list(input.tags, 12),
    status,
    ...(actor.isAdmin ? { featured: input.featured } : {}),
    ...(status === "published" && !before?.published_at ? { published_at: new Date().toISOString() } : {}),
    ...(status === "pending" ? { review_note: null } : {}),
  } as const;

  let id = before?.id ?? null;
  let slug = before?.slug ?? "";
  if (before) {
    const wanted = actor.isAdmin && input.slug.trim() ? slugify(input.slug) : before.slug;
    const { error } = await db.from("products").update({ ...fields, slug: wanted }).eq("id", before.id);
    if (error) return { error: error.code === "23505" ? "That link is already used by another product." : "Could not save the product." };
    slug = wanted;
  } else {
    const base = slugify(input.slug || title) || "product";
    for (let attempt = 0; attempt < 4 && !id; attempt++) {
      const s = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await db.from("products").insert({ ...fields, slug: s, creator_id: actor.id }).select("id, slug").single();
      if (data) [id, slug] = [data.id, data.slug];
      else if (error?.code !== "23505") return { error: "Could not create the product." };
    }
    if (!id) return { error: "Could not create a unique link. Try a different title." };
  }
  const productId = id as string;

  // Files: keep the ones still listed, add new uploads, remove the rest (and their stored copies).
  const trash: (string | null)[] = [];
  const { data: oldFiles } = await db.from("product_files").select("id, file_key").eq("product_id", productId);
  const keep = new Set(files.map((f) => f.id).filter(Boolean));
  const gone = (oldFiles ?? []).filter((f) => !keep.has(f.id));
  if (gone.length) {
    await db.from("product_files").delete().in("id", gone.map((f) => f.id));
    trash.push(...gone.map((f) => f.file_key));
  }
  for (const [position, f] of files.entries()) {
    if (f.id && keep.has(f.id) && (oldFiles ?? []).some((o) => o.id === f.id)) await db.from("product_files").update({ position }).eq("id", f.id);
    else
      await db.from("product_files").insert({ product_id: productId, file_key: keyFromUrl(f.url)!, file_name: f.name.slice(0, 200), file_size: f.size || null, mime_type: f.type.slice(0, 120) || null, position });
  }

  // Bundles: replace the item list.
  if (input.kind === "bundle" || before) {
    await db.from("bundle_items").delete().eq("bundle_id", productId);
    if (bundle.length)
      await db.from("bundle_items").insert(bundle.map((b, position) => ({ bundle_id: productId, position, course_id: b.type === "course" ? b.id : null, product_id: b.type === "product" ? b.id : null })));
  }

  if (before?.cover_url && before.cover_url !== fields.cover_url) trash.push(keyFromUrl(before.cover_url));
  for (const g of before?.gallery ?? []) if (!fields.gallery.includes(g)) trash.push(keyFromUrl(g));
  await Promise.all(trash.filter(Boolean).map((k) => deleteObject(k)));

  // A fresh submission (not a re-save of something already waiting) lets the admins know.
  if (status === "pending" && before?.status !== "pending") after(() => emailProductSubmitted(productId));

  const message = status === "published" ? "Saved and live on the marketplace." : status === "pending" ? "Submitted for review. You'll hear back by email." : "Saved as a draft.";
  return { ok: message, id: productId, slug };
}

// For the editor: a product with its files and bundle items.
export async function loadProductForEdit(id: string) {
  const db = createAdminClient();
  const { data: p } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!p) return null;
  const [{ data: files }, { data: items }, { count: owners }, { count: downloads }] = await Promise.all([
    db.from("product_files").select("id, file_key, file_name, file_size, mime_type").eq("product_id", id).order("position"),
    db.from("bundle_items").select("course_id, product_id").eq("bundle_id", id).order("position"),
    db.from("product_access").select("user_id", { count: "exact", head: true }).eq("product_id", id),
    db.from("product_downloads").select("id", { count: "exact", head: true }).eq("product_id", id),
  ]);
  return {
    product: p,
    files: (files ?? []).map((f) => ({ id: f.id, url: publicUrl(f.file_key), key: f.file_key, name: f.file_name, size: f.file_size ?? 0, type: f.mime_type ?? "" })),
    bundle: (items ?? []).map((i) => (i.course_id ? { type: "course" as const, id: i.course_id } : { type: "product" as const, id: i.product_id! })),
    owners: owners ?? 0,
    downloads: downloads ?? 0,
  };
}

// What can go in a bundle: published courses and non-bundle products (only your own, for tutors).
export async function bundleOptions(actor: Actor, excludeId?: string) {
  const db = createAdminClient();
  let cq = db.from("courses").select("id, title, price_minor").eq("status", "published").order("title");
  let pq = db.from("products").select("id, title, kind, price_minor").eq("status", "published").neq("kind", "bundle").order("title");
  if (!actor.isAdmin) {
    cq = cq.eq("instructor_id", actor.id);
    pq = pq.eq("creator_id", actor.id);
  }
  const [{ data: courses }, { data: products }] = await Promise.all([cq, pq]);
  return [
    ...(courses ?? []).map((c) => ({ type: "course" as const, id: c.id, title: c.title, priceMinor: c.price_minor, kind: "course" })),
    ...(products ?? []).filter((p) => p.id !== excludeId).map((p) => ({ type: "product" as const, id: p.id, title: p.title, priceMinor: p.price_minor, kind: p.kind as string })),
  ];
}

// Product reviews for the admin, newest first. Callers check admin access.
export async function loadProductReviews() {
  const { data } = await createAdminClient()
    .from("product_reviews")
    .select("id, rating, body, approved, admin_reply, replied_at, created_at, user_id, product_id, author:profiles!product_reviews_user_id_fkey(full_name, avatar_url), product:products(title)")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map(({ product_id, product, ...r }) => ({ ...r, course_id: product_id, author: r.author?.full_name || "Customer", avatar: r.author?.avatar_url ?? null, course: product?.title ?? "Deleted product" }));
}
