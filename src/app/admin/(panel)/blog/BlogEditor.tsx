"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, Eye, ImagePlus, PenLine, Search, UploadCloud, X } from "lucide-react";
import { RichTextEditor } from "@/components/dash/RichTextEditor";
import { CropUpload, type CropUploadHandle } from "@/components/dash/CropUpload";
import { useToast } from "@/components/dash/useToast";
import { fmtLong, readMinutes, seoChecks, type PostStatus } from "@/lib/blog";
import { slugify } from "@/lib/format";
import type { Category } from "@/lib/data/blog";
import { savePost } from "./actions";

export type EditorPost = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl: string;
  status: PostStatus;
  publishedAt: string | null;
  metaTitle: string;
  metaDesc: string;
  keyword: string;
  authorId: string;
  categoryIds: string[];
};

const SITE = "etivio.co";
const localInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const STATUSES: { value: PostStatus; label: string; icon: typeof PenLine; note: string }[] = [
  { value: "draft", label: "Draft", icon: PenLine, note: "Saved privately, not visible on the site" },
  { value: "scheduled", label: "Schedule", icon: CalendarClock, note: "Goes live by itself at the time you pick" },
  { value: "published", label: "Publish", icon: UploadCloud, note: "Goes live as soon as you save" },
];

export function BlogEditor({ initial, categories, authors }: { initial: EditorPost; categories: Category[]; authors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [saving, start] = useTransition();
  const cover = useRef<CropUploadHandle>(null);

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [content, setContent] = useState(initial.content);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [status, setStatus] = useState<PostStatus>(initial.status);
  const [at, setAt] = useState(initial.status === "scheduled" ? localInput(initial.publishedAt) : "");
  const [metaTitle, setMetaTitle] = useState(initial.metaTitle);
  const [metaDesc, setMetaDesc] = useState(initial.metaDesc);
  const [keyword, setKeyword] = useState(initial.keyword);
  const [authorId, setAuthorId] = useState(initial.authorId);
  const [cats, setCats] = useState<string[]>(initial.categoryIds);
  const [tab, setTab] = useState<"post" | "seo">("post");
  const [error, setError] = useState("");

  const seo = seoChecks({ title, excerpt, content, cover: coverUrl, metaTitle, metaDesc, keyword });
  const parents = categories.filter((c) => !c.parent_id);
  const toggleCat = (id: string) => setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  function save(forceDraft = false) {
    setError("");
    const next = forceDraft ? "draft" : status;
    if (next === "scheduled" && !at) return setError("Pick a date and time for the schedule.");
    start(async () => {
      const res = await savePost({
        id: initial.id,
        title,
        slug: slug || slugify(title),
        excerpt,
        content,
        coverUrl,
        status: next,
        scheduledAt: next === "scheduled" ? new Date(at).toISOString() : "",
        metaTitle,
        metaDesc,
        keyword,
        authorId,
        categoryIds: cats,
      });
      if (res.error) {
        setError(res.error);
        return show(res);
      }
      show(
        next === "published"
          ? "Post published. It's live on the blog."
          : next === "scheduled"
            ? `Scheduled for ${new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
            : "Draft saved. Only admins can see it.",
      );
      if (forceDraft) setStatus("draft");
      setTimeout(() => router.push("/admin/blog"), 1400);
    });
  }

  const primaryLabel = saving ? "Saving…" : status === "published" ? "Publish" : status === "scheduled" ? "Schedule" : "Save";

  return (
    <div className="et-be">
      {toast}
      <div className="et-be-bar">
        <div className="et-inline">
          <Link href="/admin/blog" className="et-be-back">
            <ArrowLeft size={14} /> All posts
          </Link>
          <span className="et-be-sep" />
          <h1>{initial.id ? "Edit post" : "New blog post"}</h1>
        </div>
        <div className="et-inline">
          <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => save(true)} disabled={saving}>
            Save draft
          </button>
          <button type="button" className={`et-btn et-btn-sm ${status === "published" ? "et-btn-success" : "et-btn-primary"}`} onClick={() => save()} disabled={saving}>
            {primaryLabel}
          </button>
        </div>
      </div>

      <div className="et-be-split">
        {/* Left: writing */}
        <div className="et-be-left">
          {error && <p className="et-flash et-flash-err">{error}</p>}

          <section className="et-card et-be-titles">
            <input
              className="et-be-title"
              value={title}
              placeholder="Post title…"
              aria-label="Title"
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
            <input className="et-be-excerpt" value={excerpt} placeholder="Excerpt: a short summary for the blog list and search results" aria-label="Excerpt" onChange={(e) => setExcerpt(e.target.value)} />
          </section>

          <RichTextEditor value={content} onChange={setContent} />

          <section className="et-card">
            <div className="et-be-label">
              <span>Cover image</span>
              <small>16:9 · saved as WebP</small>
            </div>
            {coverUrl ? (
              <div className="et-be-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl} alt="" />
                <div className="et-inline">
                  <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => cover.current?.open()}>
                    Replace
                  </button>
                  <button type="button" className="et-icon-btn" onClick={() => setCoverUrl("")} aria-label="Remove cover">
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="et-be-drop" onClick={() => cover.current?.open()}>
                <ImagePlus size={24} strokeWidth={1.5} />
                <b>Add a cover image</b>
                <small>JPG, PNG or WebP · crop and zoom before upload</small>
              </button>
            )}
          </section>

          <div className="et-be-two">
            <section className="et-card et-card-pad et-form">
              <div className="et-be-label is-flat">
                <span>URL slug</span>
              </div>
              <div className="et-be-slug">
                <span>{SITE}/blog/</span>
                <input
                  className="et-input"
                  value={slug}
                  aria-label="URL slug"
                  placeholder="post-url"
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                />
              </div>
              {authors.length > 0 && (
                <div className="et-field">
                  <label htmlFor="author">Author</label>
                  <select id="author" value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            <section className="et-card et-card-pad et-form">
              <div className="et-be-label is-flat">
                <span>Status</span>
              </div>
              <div className="et-be-status" role="radiogroup" aria-label="Status">
                {STATUSES.map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" role="radio" aria-checked={status === value} className={`is-${value}${status === value ? " is-on" : ""}`} onClick={() => setStatus(value)}>
                    <Icon size={18} strokeWidth={1.8} />
                    {label}
                  </button>
                ))}
              </div>
              {status === "scheduled" && <input type="datetime-local" className="et-input" value={at} min={localInput(new Date().toISOString())} onChange={(e) => setAt(e.target.value)} aria-label="Publish on" />}
              <small className="et-muted">
                {status === "scheduled" && at
                  ? `Goes live ${new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : STATUSES.find((s) => s.value === status)?.note}
              </small>
            </section>
          </div>

          <section className="et-card et-card-pad">
            <div className="et-be-label is-flat">
              <span>Categories</span>
              <Link href="/admin/blog/categories" className="et-be-link">
                Manage
              </Link>
            </div>
            {parents.length ? (
              <div className="et-be-cats">
                {parents.map((p) => {
                  const subs = categories.filter((c) => c.parent_id === p.id);
                  return (
                    <div key={p.id}>
                      <button type="button" className={`et-be-cat${cats.includes(p.id) ? " is-on" : ""}`} onClick={() => toggleCat(p.id)} aria-pressed={cats.includes(p.id)}>
                        <span className="et-be-check">{cats.includes(p.id) && <Check size={11} strokeWidth={3} />}</span>
                        {p.name}
                      </button>
                      {subs.length > 0 && (
                        <div className="et-be-subs">
                          {subs.map((s) => (
                            <button key={s.id} type="button" className={`et-be-sub${cats.includes(s.id) ? " is-on" : ""}`} onClick={() => toggleCat(s.id)} aria-pressed={cats.includes(s.id)}>
                              <i />
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="et-muted" style={{ fontSize: 13 }}>
                No categories yet. <Link href="/admin/blog/categories">Add some</Link> to group posts on the blog.
              </p>
            )}
          </section>

          <section className="et-card et-card-pad et-form">
            <div className="et-be-label is-flat">
              <span>
                <Search size={13} /> SEO
              </span>
              <b className={`et-be-score is-${seo.tone}`}>{seo.score}%</b>
            </div>
            <div className="et-field">
              <label htmlFor="kw">Focus keyword</label>
              <input id="kw" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. learn product design" />
            </div>
            <Meter label="Meta title" value={metaTitle} fallback={title} min={50} max={60}>
              <input id="mt" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={title || "Uses the post title if empty"} />
            </Meter>
            <Meter label="Meta description" value={metaDesc} fallback={excerpt} min={120} max={160}>
              <textarea id="md" rows={3} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} placeholder={excerpt || "Uses the excerpt if empty"} />
            </Meter>
          </section>
        </div>

        {/* Right: live preview */}
        <div className="et-be-right">
          <div className="et-be-prevbar">
            <nav className="et-seg" aria-label="Preview">
              <button type="button" className={tab === "post" ? "is-on" : ""} onClick={() => setTab("post")}>
                <Eye size={13} /> Post preview
              </button>
              <button type="button" className={tab === "seo" ? "is-on" : ""} onClick={() => setTab("seo")}>
                <Search size={13} /> SEO preview
              </button>
            </nav>
            <span className={`et-be-seo is-${seo.tone}`}>
              <i /> SEO {seo.tone === "good" ? "good" : seo.tone === "ok" ? "needs work" : "poor"}
            </span>
          </div>

          <div className="et-be-preview">
            {tab === "post" ? (
              <article className="et-be-article">
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="" className="et-be-art-cover" />
                ) : (
                  <div className="et-be-art-cover is-empty">
                    <ImagePlus size={30} strokeWidth={1.4} />
                  </div>
                )}
                <p className="et-be-art-meta">
                  {fmtLong(status === "scheduled" && at ? new Date(at).toISOString() : (initial.publishedAt ?? new Date().toISOString()))} · {readMinutes(content)} min read
                </p>
                <h1>{title || <span className="et-muted">Your title shows here…</span>}</h1>
                {excerpt && <p className="et-be-art-excerpt">{excerpt}</p>}
                <div className="et-rich" dangerouslySetInnerHTML={{ __html: content || "<p style='opacity:.4'>Your article shows here as you write…</p>" }} />
              </article>
            ) : (
              <div className="et-be-seoview">
                <p className="et-be-label is-flat">
                  <span>Google search preview</span>
                </p>
                <div className="et-be-google">
                  <p className="et-be-g-site">
                    <span>E</span>
                    <span>
                      Etivio
                      <small>
                        {SITE} › blog › {slug || "post-url"}
                      </small>
                    </span>
                  </p>
                  <p className="et-be-g-title">{seo.effTitle || "Post title…"}</p>
                  <p className="et-be-g-desc">{seo.effDesc || "Write an excerpt or meta description and it shows here."}</p>
                </div>

                <p className="et-be-label is-flat">
                  <span>Social share preview</span>
                </p>
                <div className="et-be-og">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl} alt="" />
                  ) : (
                    <div className="et-be-og-empty">No cover image yet</div>
                  )}
                  <div>
                    <small>{SITE}</small>
                    <b>{seo.effTitle || "Post title…"}</b>
                    <p>{seo.effDesc || "Description…"}</p>
                  </div>
                </div>

                <p className="et-be-label is-flat">
                  <span>SEO checklist</span>
                  <b className={`et-be-score is-${seo.tone}`}>{seo.score}%</b>
                </p>
                <span className="et-progress">
                  <span style={{ width: `${seo.score}%` }} />
                </span>
                <ul className="et-be-checks">
                  {seo.checks.map((c) => (
                    <li key={c.label} className={c.ok ? "is-ok" : ""}>
                      <span>{c.ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}</span>
                      {c.label}
                      <em>{c.value}</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <CropUpload
        ref={cover}
        title="Cover image"
        hint="Shown at the top of the post and when it's shared. 16:9 works best."
        out={{ width: 1600, height: 900 }}
        kind="blog"
        confirmLabel="Use this image"
        onUploaded={async (url) => {
          setCoverUrl(url);
          return undefined;
        }}
      />
    </div>
  );
}

function Meter({ label, value, fallback, min, max, children }: { label: string; value: string; fallback: string; min: number; max: number; children: React.ReactNode }) {
  const len = (value || fallback).length;
  const tone = len > max ? "poor" : len >= min ? "good" : "ok";
  return (
    <div className="et-field">
      <label className="et-be-meter-label">
        {label}
        <span className={`is-${tone}`}>
          {len}/{max}
        </span>
      </label>
      {children}
      <span className={`et-be-meter is-${tone}`}>
        <span style={{ width: `${Math.min(100, (len / max) * 100)}%` }} />
      </span>
    </div>
  );
}
