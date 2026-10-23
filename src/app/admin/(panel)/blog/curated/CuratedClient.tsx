"use client";
import { useState, useTransition } from "react";
import { ArrowRight, Eye, EyeOff, Globe, Link2, Trash2 } from "lucide-react";
import { useToast } from "@/components/dash/useToast";
import { fmtShort } from "@/lib/blog";
import { deleteCurated, fetchCuratedMeta, saveCurated, toggleCurated } from "../actions";
import { confirmDialog } from "@/components/dash/dialogs";

type Link = { id: string; url: string; source_name: string; title: string; excerpt: string | null; cover_url: string | null; published: boolean; created_at: string };
type Draft = { title: string; excerpt: string; sourceName: string; coverUrl: string; partial: boolean };

// Paste an article link, we read its title, summary and image, you tweak and save. Shown under "Curated sources" on the blog.
export function CuratedClient({ links }: { links: Link[] }) {
  const [toast, show] = useToast();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");

  async function fetchMeta() {
    if (!url.trim()) return;
    setFetching(true);
    setError("");
    const meta = await fetchCuratedMeta(url.trim());
    setFetching(false);
    if (meta.error) return setError(meta.error);
    setDraft({ title: meta.title, excerpt: meta.description, sourceName: meta.siteName, coverUrl: meta.image, partial: meta.partial });
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const res = await saveCurated({ url, ...draft });
      show(res);
      if (res.error) return;
      setDraft(null);
      setUrl("");
    });
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <>
      {toast}
      <div className="et-page-head">
        <div>
          <h1>Curated links</h1>
          <p>Share good articles from around the web. Paste a link and we fill in the details.</p>
        </div>
      </div>

      <section className="et-card et-card-pad et-form">
        <div className="et-be-label is-flat">
          <span>Add a link</span>
        </div>
        <div className="et-inline et-curated-input">
          <span className="et-curated-icon">
            <Link2 size={15} />
          </span>
          <input
            className="et-input"
            type="url"
            value={url}
            placeholder="https://techcabal.com/2026/…"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchMeta()}
            aria-label="Article link"
          />
          <button type="button" className="et-btn et-btn-primary" onClick={fetchMeta} disabled={fetching || !url.trim()}>
            {fetching ? "Reading…" : "Fetch"} <ArrowRight size={14} />
          </button>
        </div>
        {error && <p className="et-flash et-flash-err">{error}</p>}

        {draft && (
          <div className="et-curated-draft">
            {draft.partial && (
              <p className="et-flash et-flash-warn">
                {draft.sourceName || "This site"} doesn&apos;t share its details automatically (paywall or bot protection). Open the article and copy the title, summary and image link into the boxes below.
              </p>
            )}
            <div className="et-curated-grid">
              <div className="et-curated-card">
                <div className="et-curated-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {draft.coverUrl ? <img src={draft.coverUrl} alt="" /> : <Globe size={26} strokeWidth={1.4} />}
                  <span>{draft.sourceName || "Source"}</span>
                </div>
                <div>
                  <b>{draft.title || "Title"}</b>
                  {draft.excerpt && <p>{draft.excerpt}</p>}
                  <small>Read on {draft.sourceName || "source"} →</small>
                </div>
              </div>
              <div className="et-form">
                <div className="et-field">
                  <label htmlFor="c-title">Title</label>
                  <input id="c-title" value={draft.title} maxLength={300} onChange={(e) => set({ title: e.target.value })} />
                </div>
                <div className="et-field">
                  <label htmlFor="c-source">Source name</label>
                  <input id="c-source" value={draft.sourceName} maxLength={80} onChange={(e) => set({ sourceName: e.target.value })} />
                </div>
                <div className="et-field">
                  <label htmlFor="c-excerpt">Summary</label>
                  <textarea id="c-excerpt" rows={2} value={draft.excerpt} maxLength={600} onChange={(e) => set({ excerpt: e.target.value })} />
                </div>
                <div className="et-field">
                  <label htmlFor="c-img">Image link</label>
                  <input id="c-img" value={draft.coverUrl} placeholder="https://…" onChange={(e) => set({ coverUrl: e.target.value })} />
                </div>
                <div className="et-inline">
                  <button type="button" className="et-btn et-btn-primary" onClick={save} disabled={pending || !draft.title.trim()}>
                    {pending ? "Saving…" : "Save to curated"}
                  </button>
                  <button type="button" className="et-btn et-btn-ghost" onClick={() => setDraft(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Saved links</h2>
          <span className="et-muted" style={{ fontSize: 12.5 }}>
            {links.length} in total
          </span>
        </div>
        {links.length === 0 ? (
          <p className="et-empty">No curated links yet.</p>
        ) : (
          <ul className="et-curated-list">
            {links.map((l) => (
              <li key={l.id}>
                <span className="et-curated-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.cover_url ? <img src={l.cover_url} alt="" /> : <Globe size={18} strokeWidth={1.5} />}
                </span>
                <div>
                  <p>
                    <span className="et-tag">{l.source_name}</span>
                    <span className={`et-blog-status is-static ${l.published ? "is-published" : "is-draft"}`}>
                      <i />
                      {l.published ? "Showing" : "Hidden"}
                    </span>
                  </p>
                  <b>{l.title}</b>
                  {l.excerpt && <small>{l.excerpt}</small>}
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.url}
                  </a>
                </div>
                <span className="et-inline">
                  <small className="et-muted">{fmtShort(l.created_at)}</small>
                  <button type="button" className="et-btn et-btn-ghost et-btn-sm" disabled={pending} onClick={() => start(async () => show(await toggleCurated(l.id, !l.published)))}>
                    {l.published ? <EyeOff size={13} /> : <Eye size={13} />} {l.published ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    className="et-icon-btn is-danger"
                    disabled={pending}
                    aria-label="Delete link"
                    onClick={async () => (await confirmDialog({ title: "Delete this link?", confirmLabel: "Delete", danger: true })) && start(async () => show(await deleteCurated(l.id)))}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
