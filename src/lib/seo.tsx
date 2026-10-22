import { siteUrl } from "@/lib/email/site";

// Structured data (schema.org JSON-LD) for Google: what a page is about, so results can show prices, ratings, course
// details and breadcrumbs. https://developers.google.com/search/docs/appearance/structured-data

type Json = Record<string, unknown>;

export function JsonLd({ data }: { data: Json | Json[] }) {
  // "<" is escaped so text from courses or posts can never close the script tag early.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const abs = (path: string | null | undefined) => (!path ? undefined : path.startsWith("http") ? path : `${siteUrl()}${path}`);
const price = (minor: number) => (minor / 100).toFixed(2);
const plain = (html: string | null | undefined, max = 500) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || undefined;
const rating = (value: number | null, count: number) =>
  value && count ? { "@type": "AggregateRating", ratingValue: value, reviewCount: count, bestRating: 5, worstRating: 1 } : undefined;

export const organization = (): Json => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl()}/#organization`,
  name: "Etivio Africa",
  alternateName: "Etivio",
  url: siteUrl(),
  logo: abs("/icons/icon-512.png"),
  email: "support@etivio.co",
});

export const website = (): Json => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl()}/#website`,
  name: "Etivio",
  url: siteUrl(),
  publisher: { "@id": `${siteUrl()}/#organization` },
  potentialAction: { "@type": "SearchAction", target: `${siteUrl()}/explore?q={search_term_string}`, "query-input": "required name=search_term_string" },
});

export const breadcrumbs = (items: { name: string; path: string }[]): Json => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
});

export function course(c: {
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  coverUrl: string | null;
  level: string;
  priceMinor: number;
  currency: string;
  skills: string[];
  instructor: string;
  seconds: number;
  rating: number | null;
  reviews: number;
}): Json {
  const url = abs(`/courses/${c.slug}`);
  const hours = Math.max(1, Math.round(c.seconds / 3600));
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: c.title,
    description: plain(c.summary) ?? plain(c.description) ?? `Learn ${c.title} on Etivio.`,
    url,
    image: abs(c.coverUrl),
    inLanguage: "en",
    educationalLevel: c.level,
    teaches: c.skills.length ? c.skills : undefined,
    provider: { "@type": "Organization", name: "Etivio Africa", sameAs: siteUrl() },
    offers: {
      "@type": "Offer",
      category: c.priceMinor ? "Paid" : "Free",
      price: price(c.priceMinor),
      priceCurrency: c.currency,
      availability: "https://schema.org/InStock",
      url,
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Online",
      courseWorkload: `PT${hours}H`,
      instructor: { "@type": "Person", name: c.instructor },
    },
    aggregateRating: rating(c.rating, c.reviews),
  };
}

export function product(p: {
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  coverUrl: string | null;
  gallery: string[] | null;
  priceMinor: number;
  currency: string;
  category: string | null;
  creator: string;
  rating: number | null;
  reviews: number;
}): Json {
  const url = abs(`/products/${p.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: plain(p.summary) ?? plain(p.description) ?? p.title,
    url,
    image: [p.coverUrl, ...(p.gallery ?? [])].filter(Boolean).map((u) => abs(u)),
    category: p.category ?? undefined,
    brand: { "@type": "Brand", name: p.creator },
    offers: {
      "@type": "Offer",
      price: price(p.priceMinor),
      priceCurrency: p.currency,
      availability: "https://schema.org/InStock",
      url,
      seller: { "@type": "Organization", name: "Etivio Africa" },
    },
    aggregateRating: rating(p.rating, p.reviews),
  };
}

export function blogPosting(p: { slug: string; title: string; description: string | undefined; coverUrl: string | null; publishedAt: string | null; updatedAt: string | null; author: string | null }): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title.slice(0, 110),
    description: p.description,
    url: abs(`/blog/${p.slug}`),
    mainEntityOfPage: abs(`/blog/${p.slug}`),
    image: abs(p.coverUrl),
    datePublished: p.publishedAt ?? undefined,
    dateModified: p.updatedAt ?? p.publishedAt ?? undefined,
    author: { "@type": p.author ? "Person" : "Organization", name: p.author ?? "Etivio Africa" },
    publisher: { "@id": `${siteUrl()}/#organization` },
  };
}
