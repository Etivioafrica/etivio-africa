"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Layers, LayoutTemplate, Package, Paperclip, Plus, Sparkles, Trash2, X } from "lucide-react";
import { aiCover, aiProductCopy, aiProductDescription } from "@/app/(app)/teach/ai-actions";
import { CropUpload, type CropUploadHandle } from "@/components/dash/CropUpload";
import { RichTextEditor } from "@/components/dash/RichTextEditor";
import { Uploader } from "@/components/dash/Uploader";
import { useToast } from "@/components/dash/useToast";
import { formatBytes, formatPrice } from "@/lib/format";
import { ITEM_TYPES, PRODUCT_KINDS, type ProductKind } from "@/lib/marketplace";
import type { ProductFileInput, ProductInput } from "@/lib/data/products-admin";
import { Select } from "@/components/dash/Select";

type BundleOption = { type: "course" | "product"; id: string; title: string; priceMinor: number; kind: string };
type Result = { ok?: string; error?: string; id?: string; slug?: string };

const KIND_INFO: Record<ProductKind, { icon: typeof Layers; hint: string }> = {
  template: { icon: LayoutTemplate, hint: "Figma, Canva, Notion, spreadsheets, docs" },
  ebook: { icon: FileText, hint: "PDF books and written guides" },
  resource_pack: { icon: Package, hint: "Icons, fonts, photos, mockups" },
  bundle: { icon: Layers, hint: "Courses and products sold together" },
};

// Create or edit a marketplace product. Admins publish directly; tutors submit for review.
export function ProductEditor({
  mode,
  initial,
  status,
  reviewNote,
  categories,
  bundleOptions,
  backHref,
  onSave,
  ai = true,
}: {
  mode: "admin" | "tutor";
  initial?: Omit<ProductInput, "intent"> & { id: string };
  status?: string;
  reviewNote?: string | null;
  categories: { id: string; name: string }[];
  bundleOptions: BundleOption[];
  backHref: string;
  onSave: (input: ProductInput) => Promise<Result>;
  // AI writing and cover tools (Settings → Features).
  ai?: boolean;
}) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [busy, start] = useTransition();
  const cover = useRef<CropUploadHandle>(null);
  const [f, setF] = useState<Omit<ProductInput, "intent">>(
    initial ?? { kind: "template", title: "", slug: "", summary: "", description: "", coverUrl: "", gallery: [], priceNaira: "", compareAtNaira: "", categoryId: "", formats: "", tags: "", featured: false, files: [], bundle: [] },
  );
  const [fileKey, setFileKey] = useState(0);
  const [galleryKey, setGalleryKey] = useState(0);
  const [pick, setPick] = useState("");
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const live = status === "published";

  const optionKey = (o: { type: string; id: string }) => `${o.type}:${o.id}`;
  const inBundle = new Set(f.bundle.map(optionKey));
  const bundleRows = f.bundle.map((b) => bundleOptions.find((o) => optionKey(o) === optionKey(b))).filter(Boolean) as BundleOption[];
  const bundleValue = bundleRows.reduce((n, b) => n + b.priceMinor, 0);

  const [aiBusy, setAiBusy] = useState<"copy" | "description" | "cover" | null>(null);
  const canAi = !aiBusy && f.title.trim().length >= 4;

  async function aiWrite() {
    setAiBusy("copy");
    const res = await aiProductCopy({ kind: ITEM_TYPES[f.kind].label, title: f.title, formats: f.formats, notes: f.description, items: bundleRows.map((b) => b.title) });
    setAiBusy(null);
    if (!res.ok) return show({ error: res.error });
    set({
      ...(res.data.summary ? { summary: res.data.summary } : {}),
      ...(res.data.description ? { description: res.data.description } : {}),
      ...(res.data.tags.length ? { tags: res.data.tags.join(", ") } : {}),
      ...(!f.formats.trim() && res.data.formats.length ? { formats: res.data.formats.join(", ") } : {}),
    });
    show({ ok: "Details written. Read them through and edit anything that isn't right." });
  }

  async function aiDescribe() {
    setAiBusy("description");
    const res = await aiProductDescription({ kind: ITEM_TYPES[f.kind].label, title: f.title, summary: f.summary, formats: f.formats, existing: f.description, items: bundleRows.map((b) => b.title) });
    setAiBusy(null);
    if (!res.ok) return show({ error: res.error });
    set({ description: res.data });
    show({ ok: "Description written. Read it through and edit anything that isn't right." });
  }

  async function aiMakeCover() {
    setAiBusy("cover");
    const res = await aiCover({ title: f.title, summary: f.summary });
    setAiBusy(null);
    if (!res.ok) return show({ error: res.error });
    set({ coverUrl: res.data });
  }

  function save(intent: ProductInput["intent"]) {
    start(async () => {
      const res = await onSave({ ...f, intent });
      show(res);
      if (res.error) return;
      if (!initial && res.id) router.push(`${backHref}/${res.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="et-page et-pe">
      {toast}
      <p className="et-set-crumb">
        <Link href={backHref}>{mode === "admin" ? "Marketplace" : "Products"}</Link> <span>/</span> {initial ? f.title || "Edit" : "New product"}
      </p>
      <div className="et-page-head">
        <div>
          <h1>{initial ? "Edit product" : "New product"}</h1>
          <p>{mode === "admin" ? "Publish templates, e-books, resource packs and bundles to the marketplace." : "Add a product. The Etivio team reviews it before it goes live."}</p>
        </div>
        {initial && live && (
          <Link href={`/products/${f.slug}`} className="et-btn et-btn-ghost" target="_blank">
            View live page
          </Link>
        )}
      </div>

      {status === "rejected" && reviewNote && (
        <p className="et-flash et-flash-warn">
          <b>Changes requested:</b> {reviewNote}
        </p>
      )}
      {status === "pending" && <p className="et-flash">This product is waiting for review.</p>}

      <div className="et-pe-grid">
        <div className="et-pe-main">
          <section className="et-card et-card-pad et-form">
            <span className="et-pe-label">What are you selling?</span>
            <div className="et-pe-kinds">
              {PRODUCT_KINDS.map((k) => {
                const Icon = KIND_INFO[k].icon;
                return (
                  <button key={k} type="button" className={f.kind === k ? "is-on" : ""} onClick={() => set({ kind: k })} disabled={!!initial && f.kind !== k && (k === "bundle" || f.kind === "bundle")}>
                    <Icon size={18} />
                    <b>{ITEM_TYPES[k].label}</b>
                    <small>{KIND_INFO[k].hint}</small>
                  </button>
                );
              })}
            </div>
            <div className="et-field">
              <label htmlFor="pe-title">Title</label>
              <input id="pe-title" className="et-input" value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={140} placeholder="e.g. Startup Pitch Deck Template" />
            </div>
            {ai && (
            <button type="button" className="et-btn et-btn-ghost et-btn-sm et-ai-inline" disabled={!canAi} onClick={aiWrite}>
              <Sparkles size={13} /> {aiBusy === "copy" ? "Writing…" : "Write the summary, description and tags with AI"}
            </button>
            )}
            <div className="et-field">
              <label htmlFor="pe-summary">Short summary</label>
              <textarea id="pe-summary" className="et-input" rows={2} value={f.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={300} placeholder="One or two lines shown on cards and at the top of the page." />
              <small>{f.summary.length}/300</small>
            </div>
            <div className="et-field">
              <div className="et-pe-labelrow">
                <label>Description</label>
                {ai && (
                <button type="button" className="et-btn et-btn-ghost et-btn-sm et-ai-inline" disabled={!canAi} onClick={aiDescribe}>
                  <Sparkles size={13} /> {aiBusy === "description" ? "Writing…" : f.description.replace(/<[^>]+>/g, "").trim() ? "Improve with AI" : "Write with AI"}
                </button>
                )}
              </div>
              <RichTextEditor value={f.description} onChange={(html) => set({ description: html })} />
            </div>
          </section>

          {f.kind === "bundle" ? (
            <section className="et-card et-card-pad">
              <div className="et-pe-head">
                <h2>What&apos;s in the bundle</h2>
                {bundleValue > 0 && <small>Worth {formatPrice(bundleValue)} separately</small>}
              </div>
              <ul className="et-pe-list">
                {bundleRows.map((b) => (
                  <li key={optionKey(b)}>
                    <span className="et-tag">{ITEM_TYPES[(b.kind in ITEM_TYPES ? b.kind : "course") as keyof typeof ITEM_TYPES].label}</span>
                    <b>{b.title}</b>
                    <small>{b.priceMinor ? formatPrice(b.priceMinor) : "Free"}</small>
                    <button type="button" className="et-icon-btn" onClick={() => set({ bundle: f.bundle.filter((x) => optionKey(x) !== optionKey(b)) })} aria-label={`Remove ${b.title}`}>
                      <X size={14} />
                    </button>
                  </li>
                ))}
                {!bundleRows.length && <li className="et-muted">Add at least two courses or products.</li>}
              </ul>
              <div className="et-inline" style={{ marginTop: 12 }}>
                <Select className="et-select" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add to bundle" style={{ flex: 1 }}>
                  <option value="">Choose a course or product…</option>
                  {bundleOptions
                    .filter((o) => !inBundle.has(optionKey(o)))
                    .map((o) => (
                      <option key={optionKey(o)} value={optionKey(o)}>
                        {o.type === "course" ? "Course" : ITEM_TYPES[o.kind as ProductKind]?.label ?? "Product"}: {o.title}
                      </option>
                    ))}
                </Select>
                <button
                  type="button"
                  className="et-btn et-btn-ghost"
                  disabled={!pick}
                  onClick={() => {
                    const [type, id] = pick.split(":");
                    set({ bundle: [...f.bundle, { type: type as "course" | "product", id }] });
                    setPick("");
                  }}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </section>
          ) : (
            <section className="et-card et-card-pad">
              <div className="et-pe-head">
                <h2>Files buyers download</h2>
                <small>Up to 500 MB each. Only owners can download them.</small>
              </div>
              <ul className="et-pe-list">
                {f.files.map((file: ProductFileInput) => (
                  <li key={file.url}>
                    <Paperclip size={15} />
                    <b>{file.name}</b>
                    {file.size ? <small>{formatBytes(file.size)}</small> : null}
                    <button type="button" className="et-icon-btn" onClick={() => set({ files: f.files.filter((x) => x.url !== file.url) })} aria-label={`Remove ${file.name}`}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <Uploader
                key={fileKey}
                name="product-file"
                kind="product"
                label={f.files.length ? "Add another file" : "Click or drop a file to upload"}
                onUploaded={(u) => {
                  setF((x) => ({ ...x, files: [...x.files, u] }));
                  setFileKey((k) => k + 1);
                }}
              />
            </section>
          )}

          <section className="et-card et-card-pad">
            <div className="et-pe-head">
              <h2>Preview images</h2>
              <small>Optional. Show what&apos;s inside: pages, screens, samples.</small>
            </div>
            {f.gallery.length > 0 && (
              <div className="et-pe-gallery">
                {f.gallery.map((src) => (
                  <div key={src}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                    <button type="button" onClick={() => set({ gallery: f.gallery.filter((g) => g !== src) })} aria-label="Remove image">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {f.gallery.length < 12 && (
              <Uploader
                key={galleryKey}
                name="gallery-image"
                kind="blog"
                label="Add a preview image"
                onUploaded={(u) => {
                  setF((x) => ({ ...x, gallery: [...x.gallery, u.url] }));
                  setGalleryKey((k) => k + 1);
                }}
              />
            )}
          </section>
        </div>

        <aside className="et-pe-side">
          <section className="et-card et-card-pad et-form">
            <span className="et-pe-label">Cover image</span>
            {f.coverUrl ? (
              <div className="et-pe-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.coverUrl} alt="" />
                <div>
                  <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => cover.current?.open()}>
                    Replace
                  </button>
                  {ai && (
                  <button type="button" className="et-btn et-btn-ghost et-btn-sm et-ai-inline" disabled={!canAi} onClick={aiMakeCover}>
                    <Sparkles size={13} /> {aiBusy === "cover" ? "Creating…" : "New AI cover"}
                  </button>
                  )}
                  <button type="button" className="et-icon-btn" onClick={() => set({ coverUrl: "" })} aria-label="Remove cover">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="et-be-drop et-wiz-drop" onClick={() => cover.current?.open()}>
                <ImagePlus size={22} strokeWidth={1.5} />
                <b>Add a cover</b>
                <small>16:9 · shown on cards and the product page</small>
              </button>
            )}
            {!f.coverUrl && ai && (
              <button type="button" className="et-btn et-btn-ghost et-btn-sm et-ai-inline" disabled={!canAi} onClick={aiMakeCover}>
                <Sparkles size={13} /> {aiBusy === "cover" ? "Creating a cover…" : "Or generate a cover with AI"}
              </button>
            )}
            <div className="et-form-grid">
              <div className="et-field">
                <label htmlFor="pe-price">Price (₦)</label>
                <input id="pe-price" className="et-input" inputMode="decimal" value={f.priceNaira} onChange={(e) => set({ priceNaira: e.target.value })} placeholder="0 for free" />
              </div>
              <div className="et-field">
                <label htmlFor="pe-was">&quot;Was&quot; price (₦)</label>
                <input id="pe-was" className="et-input" inputMode="decimal" value={f.compareAtNaira} onChange={(e) => set({ compareAtNaira: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div className="et-field">
              <label htmlFor="pe-cat">Category</label>
              <Select id="pe-cat" className="et-select" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            {f.kind !== "bundle" && (
              <div className="et-field">
                <label htmlFor="pe-formats">Formats</label>
                <input id="pe-formats" className="et-input" value={f.formats} onChange={(e) => set({ formats: e.target.value })} placeholder="Figma, PDF, Canva" />
                <small>What the files open in. Separate with commas.</small>
              </div>
            )}
            <div className="et-field">
              <label htmlFor="pe-tags">Tags</label>
              <input id="pe-tags" className="et-input" value={f.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="pitch deck, startup, investors" />
              <small>Help people find it in search. Separate with commas.</small>
            </div>
            {mode === "admin" && initial && (
              <div className="et-field">
                <label htmlFor="pe-slug">Link</label>
                <input id="pe-slug" className="et-input" value={f.slug} onChange={(e) => set({ slug: e.target.value })} />
                <small>etivio.co/products/{f.slug || "…"}</small>
              </div>
            )}
            {mode === "admin" && (
              <label className="et-check">
                <input type="checkbox" checked={f.featured} onChange={(e) => set({ featured: e.target.checked })} /> Feature on the marketplace
              </label>
            )}
          </section>

          <section className="et-card et-card-pad et-pe-actions">
            {status && <p className="et-muted">Status: <b className="et-cap">{status}</b></p>}
            {mode === "admin" ? (
              <>
                <button type="button" className="et-btn et-btn-success" disabled={busy} onClick={() => save("publish")}>
                  {busy ? "Saving…" : live ? "Save changes" : "Publish"}
                </button>
                {!live && (
                  <button type="button" className="et-btn et-btn-ghost" disabled={busy} onClick={() => save("draft")}>
                    Save as draft
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" className="et-btn et-btn-primary" disabled={busy} onClick={() => save("submit")}>
                  {busy ? "Saving…" : live ? "Submit changes for review" : "Submit for review"}
                </button>
                <button type="button" className="et-btn et-btn-ghost" disabled={busy} onClick={() => save("draft")}>
                  Save as draft
                </button>
                {live && <small className="et-muted">Editing a live product sends it back for a quick review.</small>}
              </>
            )}
          </section>
        </aside>
      </div>

      <CropUpload
        ref={cover}
        title="Product cover"
        hint="Shown on marketplace cards and the product page. 16:9 works best."
        out={{ width: 1600, height: 900 }}
        kind="cover"
        confirmLabel="Use this image"
        onUploaded={async (url) => {
          set({ coverUrl: url });
          return undefined;
        }}
      />
    </div>
  );
}
