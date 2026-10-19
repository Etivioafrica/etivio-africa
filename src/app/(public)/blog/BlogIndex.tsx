"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Globe, Newspaper, Search, X } from "lucide-react";
import { fmtShort } from "@/lib/blog";
import type { Category, CuratedLink, PostCat, PublicPost } from "@/lib/data/blog";

type Post = Omit<PublicPost, "content"> & { words: number };
const PER_PAGE = 12;
const mins = (words: number) => Math.max(1, Math.round(words / 200));

export function BlogIndex({ posts, categories, postCats, curated }: { posts: Post[]; categories: Category[]; postCats: PostCat[]; curated: CuratedLink[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [curatedPage, setCuratedPage] = useState(1);

  const featured = posts.find((p) => p.featured) ?? posts[0] ?? null;
  const latest = posts.filter((p) => p.id !== featured?.id).slice(0, 5);
  const parents = categories.filter((c) => !c.parent_id);

  const catsOf = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const pc of postCats) (m[pc.post_id] ??= []).push(pc.category_id);
    return m;
  }, [postCats]);
  // Only offer categories that have posts in them.
  const usedParents = parents.filter((p) => posts.some((post) => (catsOf[post.id] ?? []).some((c) => c === p.id || categories.find((x) => x.id === c)?.parent_id === p.id)));

  const q = search.trim().toLowerCase();
  const filtered = posts.filter((p) => {
    if (active) {
      const ok = new Set([active, ...categories.filter((c) => c.parent_id === active).map((c) => c.id)]);
      if (!(catsOf[p.id] ?? []).some((c) => ok.has(c))) return false;
    }
    return !q || p.title.toLowerCase().includes(q) || (p.excerpt ?? "").toLowerCase().includes(q);
  });
  const pages = Math.ceil(filtered.length / PER_PAGE);
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const curatedPages = Math.ceil(curated.length / PER_PAGE);
  const curatedShown = curated.slice((curatedPage - 1) * PER_PAGE, curatedPage * PER_PAGE);
  const firstCat = (id: string) => categories.find((c) => c.id === (catsOf[id] ?? [])[0])?.name ?? null;

  const pick = (id: string | null) => {
    setActive(id);
    setPage(1);
  };

  if (!posts.length && !curated.length)
    return (
      <section className="et-card et-blog-empty">
        <span className="et-cta-icon">
          <Newspaper size={22} />
        </span>
        <h1>The Etivio blog is coming soon</h1>
        <p>Guides, stories and career advice are on the way. Check back shortly.</p>
        <Link href="/" className="et-btn et-btn-primary">
          Explore courses <ArrowRight size={15} />
        </Link>
      </section>
    );

  return (
    <div className="et-pb">
      {featured && (
        <section className={`et-pb-hero${latest.length ? "" : " is-solo"}`}>
          <div>
            <h2>Featured</h2>
            <Link href={`/blog/${featured.slug}`} className="et-pb-featured">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {featured.cover_url ? <img src={featured.cover_url} alt="" /> : <span className="et-pb-noimg" />}
              <span className="et-pb-shade" />
              <span className="et-pb-feat-text">
                <small>
                  {fmtShort(featured.published_at)} · {mins(featured.words)} min read
                </small>
                <b>{featured.title}</b>
                <em>Read more</em>
              </span>
            </Link>
          </div>
          {latest.length > 0 && (
            <div>
              <h2>Latest posts</h2>
              <ul className="et-pb-latest">
                {latest.map((p) => (
                  <li key={p.id}>
                    <Link href={`/blog/${p.slug}`}>
                      <span className="et-pb-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.cover_url && <img src={p.cover_url} alt="" />}
                      </span>
                      <span>
                        <small>{fmtShort(p.published_at)}</small>
                        <b>{p.title}</b>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {posts.length > 0 && (
        <section className="et-pb-section">
          <div className="et-pb-bar">
            <nav className="et-pb-chips" aria-label="Categories">
              <button type="button" className={active === null ? "is-on" : ""} onClick={() => pick(null)}>
                All posts
              </button>
              {usedParents.map((c) => (
                <button key={c.id} type="button" className={active === c.id ? "is-on" : ""} onClick={() => pick(c.id)}>
                  {c.name}
                </button>
              ))}
            </nav>
            <label className="et-pb-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search posts…"
                aria-label="Search posts"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
          </div>

          {filtered.length > 0 && (
            <p className="et-pb-count">
              Showing {(page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} {filtered.length === 1 ? "post" : "posts"}
            </p>
          )}

          {filtered.length === 0 ? (
            <p className="et-pb-none">
              No posts found{search ? ` for "${search}"` : ""}.{" "}
              {(search || active) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    pick(null);
                  }}
                >
                  Clear filters
                </button>
              )}
            </p>
          ) : (
            <div className="et-pb-grid">
              {shown.map((p) => {
                const cat = firstCat(p.id);
                return (
                  <Link key={p.id} href={`/blog/${p.slug}`} className="et-pb-card">
                    <span className="et-pb-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.cover_url && <img src={p.cover_url} alt="" />}
                      {cat && <span>{cat}</span>}
                    </span>
                    <small>
                      {fmtShort(p.published_at)} · {mins(p.words)} min read
                    </small>
                    <b>{p.title}</b>
                    {p.excerpt && <p>{p.excerpt}</p>}
                    <em>
                      Read more <ArrowRight size={13} />
                    </em>
                  </Link>
                );
              })}
            </div>
          )}
          <Pager page={page} total={pages} onChange={setPage} />
        </section>
      )}

      {curated.length > 0 && (
        <section className="et-pb-section et-pb-curated" id="curated">
          <div className="et-pb-curated-head">
            <h2>
              <Globe size={18} /> Curated sources
            </h2>
            <p>Good reads from around the web, picked by the Etivio team.</p>
          </div>
          <div className="et-pb-grid">
            {curatedShown.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="et-pb-card is-curated">
                <span className="et-pb-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.cover_url ? <img src={l.cover_url} alt="" /> : <Globe size={28} strokeWidth={1.3} />}
                  <span>{l.source_name}</span>
                </span>
                <b>{l.title}</b>
                {l.excerpt && <p>{l.excerpt}</p>}
                <em>
                  Read on {l.source_name} <ArrowRight size={13} />
                </em>
              </a>
            ))}
          </div>
          <Pager page={curatedPage} total={curatedPages} onChange={setCuratedPage} anchor="curated" />
        </section>
      )}
    </div>
  );
}

function Pager({ page, total, onChange, anchor }: { page: number; total: number; onChange: (p: number) => void; anchor?: string }) {
  if (total <= 1) return null;
  const go = (p: number) => {
    onChange(p);
    const el = anchor ? document.getElementById(anchor) : null;
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums.at(-1) !== "…") nums.push("…");
  }
  return (
    <nav className="et-pb-pager" aria-label="Pages">
      <button type="button" onClick={() => go(page - 1)} disabled={page === 1} aria-label="Previous page">
        <ChevronLeft size={16} />
      </button>
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`}>…</span>
        ) : (
          <button key={n} type="button" className={n === page ? "is-on" : ""} onClick={() => go(n)} aria-current={n === page ? "page" : undefined}>
            {n}
          </button>
        ),
      )}
      <button type="button" onClick={() => go(page + 1)} disabled={page === total} aria-label="Next page">
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
