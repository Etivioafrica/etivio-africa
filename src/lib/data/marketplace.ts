import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import type { ExploreItem, ProductKind } from "@/lib/marketplace";

// Public marketplace reads. Service role, but only ever returns published items and public-safe fields.

// The signed-in person, or null for visitors. Never redirects, so public pages work logged out.
export async function viewer() {
  return sessionUser(await createClient());
}

export async function getCategories() {
  const { data } = await createAdminClient().from("course_categories").select("id, name, slug, parent_id").order("name");
  return data ?? [];
}

// Everything live on the marketplace. Small catalogue, so filtering and sorting happen on the page.
export async function getExploreItems(): Promise<ExploreItem[]> {
  const db = createAdminClient();
  const [{ data: courses }, { data: products }, { data: metrics }, { data: cats }, { data: access }, { data: files }, { data: items }] = await Promise.all([
    db
      .from("courses")
      .select("id, slug, title, summary, cover_url, price_minor, currency, category_id, level, skills, featured, published_at, instructor:profiles!courses_instructor_id_fkey(full_name, avatar_url)")
      .eq("status", "published")
      .eq("marketplace_listed", true),
    db
      .from("products")
      .select("id, kind, slug, title, summary, cover_url, price_minor, compare_at_minor, currency, category_id, tags, formats, featured, published_at, creator:profiles!products_creator_id_fkey(full_name, avatar_url)")
      .eq("status", "published"),
    db.rpc("course_metrics"),
    db.from("course_categories").select("id, name"),
    db.from("product_access").select("product_id"),
    db.from("product_files").select("product_id"),
    db.from("bundle_items").select("bundle_id"),
  ]);
  const courseIds = (courses ?? []).map((c) => c.id);
  const productIds = (products ?? []).map((p) => p.id);
  const [{ data: lessons }, { data: ratings }] = await Promise.all([
    courseIds.length ? db.from("lessons").select("course_id").in("course_id", courseIds) : Promise.resolve({ data: [] }),
    productIds.length ? db.rpc("product_ratings", { p_product_ids: productIds }) : Promise.resolve({ data: [] }),
  ]);
  const productRating = new Map((ratings ?? []).map((r) => [r.product_id, r]));

  const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
  const tally = (rows: { [k: string]: string }[] | null, key: string) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r[key], (m.get(r[key]) ?? 0) + 1);
    return m;
  };
  const lessonCount = tally(lessons, "course_id");
  const owners = tally(access, "product_id");
  const fileCount = tally(files, "product_id");
  const bundleCount = tally(items, "bundle_id");
  const metric = new Map((metrics ?? []).map((m) => [m.course_id, m]));

  return [
    ...(courses ?? []).map((c): ExploreItem => {
      const m = metric.get(c.id);
      return {
        type: "course",
        id: c.id,
        slug: c.slug,
        title: c.title,
        summary: c.summary,
        coverUrl: c.cover_url,
        priceMinor: c.price_minor,
        compareAtMinor: null,
        currency: c.currency,
        creator: c.instructor?.full_name || "Etivio",
        creatorAvatar: c.instructor?.avatar_url ?? null,
        category: c.category_id ? (catName.get(c.category_id) ?? null) : null,
        categoryId: c.category_id,
        level: c.level,
        rating: m?.rating === null || m?.rating === undefined ? null : Number(m.rating),
        reviews: m?.reviews ?? 0,
        popularity: m?.students ?? 0,
        count: lessonCount.get(c.id) ?? 0,
        formats: [],
        tags: c.skills ?? [],
        featured: c.featured,
        publishedAt: c.published_at,
      };
    }),
    ...(products ?? []).map(
      (p): ExploreItem => ({
        type: p.kind,
        id: p.id,
        slug: p.slug,
        title: p.title,
        summary: p.summary,
        coverUrl: p.cover_url,
        priceMinor: p.price_minor,
        compareAtMinor: p.compare_at_minor,
        currency: p.currency,
        creator: p.creator?.full_name || "Etivio",
        creatorAvatar: p.creator?.avatar_url ?? null,
        category: p.category_id ? (catName.get(p.category_id) ?? null) : null,
        categoryId: p.category_id,
        level: null,
        rating: productRating.has(p.id) ? Number(productRating.get(p.id)!.rating) : null,
        reviews: productRating.get(p.id)?.reviews ?? 0,
        popularity: owners.get(p.id) ?? 0,
        count: p.kind === "bundle" ? (bundleCount.get(p.id) ?? 0) : (fileCount.get(p.id) ?? 0),
        formats: p.formats,
        tags: p.tags,
        featured: p.featured,
        publishedAt: p.published_at,
      }),
    ),
  ];
}

export type BundleEntry = { type: "course" | ProductKind; slug: string; title: string; coverUrl: string | null; priceMinor: number; currency: string };

// One product page. Files are listed by name and size only; downloads go through /api/download.
export async function getPublicProduct(slug: string) {
  const db = createAdminClient();
  const { data: p } = await db
    .from("products")
    .select(
      "id, kind, slug, title, summary, description, cover_url, gallery, price_minor, compare_at_minor, currency, category_id, tags, formats, featured, status, published_at, updated_at, creator_id, creator:profiles!products_creator_id_fkey(full_name, avatar_url, headline, bio, username, profile_public)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!p || p.status !== "published") return null;

  const user = await viewer();
  const [{ data: files }, { data: items }, { count: owners }, cat, access, saved, { data: reviews }, mine] = await Promise.all([
    db.from("product_files").select("id, file_name, file_size, mime_type").eq("product_id", p.id).order("position"),
    db.from("bundle_items").select("position, course:courses(slug, title, cover_url, price_minor, currency, status), product:products!bundle_items_product_id_fkey(kind, slug, title, cover_url, price_minor, currency, status)").eq("bundle_id", p.id).order("position"),
    db.from("product_access").select("user_id", { count: "exact", head: true }).eq("product_id", p.id),
    p.category_id ? db.from("course_categories").select("name").eq("id", p.category_id).maybeSingle() : Promise.resolve({ data: null }),
    user ? db.from("product_access").select("granted_at").eq("product_id", p.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? db.from("saved_products").select("product_id").eq("product_id", p.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    db
      .from("product_reviews")
      .select("id, rating, body, admin_reply, created_at, author:profiles!product_reviews_user_id_fkey(full_name, avatar_url)")
      .eq("product_id", p.id)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(200),
    user ? db.from("product_reviews").select("rating, body, approved, admin_reply").eq("product_id", p.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const rated = reviews ?? [];
  const isCreator = !!user && user.id === p.creator_id;

  const bundle: BundleEntry[] = (items ?? []).flatMap((i): BundleEntry[] => {
    if (i.course && i.course.status === "published") return [{ type: "course" as const, slug: i.course.slug, title: i.course.title, coverUrl: i.course.cover_url, priceMinor: i.course.price_minor, currency: i.course.currency }];
    if (i.product && i.product.status === "published") return [{ type: i.product.kind, slug: i.product.slug, title: i.product.title, coverUrl: i.product.cover_url, priceMinor: i.product.price_minor, currency: i.product.currency }];
    return [];
  });

  return {
    product: {
      id: p.id,
      kind: p.kind,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      description: p.description,
      coverUrl: p.cover_url,
      gallery: p.gallery,
      priceMinor: p.price_minor,
      compareAtMinor: p.compare_at_minor,
      currency: p.currency,
      category: cat?.data?.name ?? null,
      tags: p.tags,
      formats: p.formats,
      featured: p.featured,
      publishedAt: p.published_at,
      updatedAt: p.updated_at,
    },
    creator: {
      name: p.creator?.full_name || "Etivio",
      avatar: p.creator?.avatar_url ?? null,
      headline: p.creator?.headline ?? null,
      bio: p.creator?.bio ?? null,
      profile: p.creator?.profile_public && p.creator.username ? `/@${p.creator.username}` : null,
    },
    files: (files ?? []).map((f) => ({ id: f.id, name: f.file_name, size: f.file_size, type: f.mime_type })),
    bundle,
    owners: owners ?? 0,
    owned: !!access.data || isCreator,
    rating: rated.length ? Math.round((rated.reduce((n, r) => n + r.rating, 0) / rated.length) * 10) / 10 : null,
    reviews: rated.slice(0, 6).map((r) => ({ id: r.id, rating: r.rating, body: r.body, reply: r.admin_reply, at: r.created_at, author: r.author?.full_name || "Customer", avatar: r.author?.avatar_url ?? null })),
    reviewCount: rated.length,
    // Owners can review; the creator can't review their own product.
    review: { canReview: !!access.data && !isCreator, mine: mine.data ?? null },
    saved: !!saved.data,
    signedIn: !!user,
  };
}

export type PublicProduct = NonNullable<Awaited<ReturnType<typeof getPublicProduct>>>;

// Just enough for link previews (WhatsApp, X, LinkedIn) and search results. No session needed.
export async function itemMeta(type: "course" | "product", slug: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const db = createAdminClient();
  const { data } =
    type === "course"
      ? await db.from("courses").select("title, summary, cover_url, status").eq("slug", slug).maybeSingle()
      : await db.from("products").select("title, summary, cover_url, status").eq("slug", slug).maybeSingle();
  return data && data.status === "published" ? { title: data.title, summary: data.summary, cover: data.cover_url } : null;
}

// Products someone owns, newest first, with their files (ids only; downloads go through /api/download).
export async function getLibrary(userId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("product_access")
    .select("granted_at, product:products(id, kind, slug, title, summary, cover_url, formats, status, creator:profiles!products_creator_id_fkey(full_name))")
    .eq("user_id", userId)
    .order("granted_at", { ascending: false });
  const owned = (data ?? []).filter((r) => r.product);
  const ids = owned.map((r) => r.product!.id);
  const { data: files } = ids.length ? await db.from("product_files").select("id, product_id, file_name, file_size").in("product_id", ids).order("position") : { data: [] };
  return owned.map((r) => {
    const p = r.product!;
    return {
      id: p.id,
      kind: p.kind,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      coverUrl: p.cover_url,
      formats: p.formats,
      creator: p.creator?.full_name || "Etivio",
      // Still downloadable after it's unpublished: they own it.
      live: p.status === "published",
      grantedAt: r.granted_at,
      files: (files ?? []).filter((f) => f.product_id === p.id).map((f) => ({ id: f.id, name: f.file_name, size: f.file_size })),
    };
  });
}
