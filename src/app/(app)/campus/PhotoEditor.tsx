"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, Move, RotateCw, SlidersHorizontal, Sparkles, X, ZoomIn, ZoomOut } from "lucide-react";
import { CROP_START, clampCrop, cropScale, type CropState } from "@/lib/image-crop";

type Size = { width: number; height: number };
type Tab = "crop" | "filter" | "adjust";

const RATIOS: { key: string; label: string; ratio: number | null }[] = [
  { key: "original", label: "Original", ratio: null },
  { key: "square", label: "Square", ratio: 1 },
  { key: "portrait", label: "Portrait", ratio: 4 / 5 },
  { key: "landscape", label: "Landscape", ratio: 16 / 9 },
];

const FILTERS: { key: string; label: string; css: string }[] = [
  { key: "none", label: "Original", css: "" },
  { key: "vivid", label: "Vivid", css: "saturate(1.35) contrast(1.08)" },
  { key: "warm", label: "Warm", css: "sepia(0.22) saturate(1.2) hue-rotate(-8deg)" },
  { key: "cool", label: "Cool", css: "saturate(1.08) hue-rotate(14deg) brightness(1.03)" },
  { key: "mono", label: "Mono", css: "grayscale(1) contrast(1.1)" },
  { key: "fade", label: "Fade", css: "contrast(0.86) brightness(1.08) saturate(0.82)" },
  { key: "drama", label: "Drama", css: "contrast(1.3) saturate(1.1) brightness(0.94)" },
];

const MAX_OUT = 2048;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that photo. Try another one."));
    img.src = src;
  });
}

// Edit a photo before it goes on a Campus post: crop to a shape, drag and zoom, rotate, pick a filter and adjust
// light and colour. `onDone` gets the edited photo as a new file; nothing is uploaded until then.
export function PhotoEditor({ file, onDone, onCancel }: { file: File; onDone: (edited: File) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [src, setSrc] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("crop");
  const [ratioKey, setRatioKey] = useState("original");
  const [crop, setCrop] = useState<CropState>(CROP_START);
  const [filter, setFilter] = useState("none");
  const [adjust, setAdjust] = useState({ brightness: 100, contrast: 100, saturation: 100 });
  const [busy, setBusy] = useState(false);

  // Load the picked file (and again after each rotation).
  const show = useCallback(async (url: string) => {
    try {
      const img = await loadImage(url);
      setSrc((old) => {
        if (old && old.url !== url) URL.revokeObjectURL(old.url);
        return { url, img };
      });
      setCrop(CROP_START);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Open with the picked file.
  useEffect(() => {
    dialog.current?.showModal();
    const url = URL.createObjectURL(file);
    let live = true;
    loadImage(url).then(
      (img) => live && setSrc({ url, img }),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [file]);
  useEffect(
    () => () => {
      if (src) URL.revokeObjectURL(src.url);
    },
    [src],
  );

  const natural = src ? { width: src.img.naturalWidth, height: src.img.naturalHeight } : null;
  const ratio = RATIOS.find((r) => r.key === ratioKey)?.ratio ?? (natural ? natural.width / natural.height : 1);
  const look = [FILTERS.find((f) => f.key === filter)?.css ?? "", adjust.brightness !== 100 ? `brightness(${adjust.brightness / 100})` : "", adjust.contrast !== 100 ? `contrast(${adjust.contrast / 100})` : "", adjust.saturation !== 100 ? `saturate(${adjust.saturation / 100})` : ""]
    .filter(Boolean)
    .join(" ");

  async function rotate() {
    if (!src || busy) return;
    const { img } = src;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (blob) void show(URL.createObjectURL(blob));
  }

  async function done() {
    if (!src || !natural) return;
    setBusy(true);
    setError("");
    try {
      // The part of the photo inside the frame, in the photo's own pixels.
      const frame = { width: 1000, height: 1000 / ratio };
      const s = cropScale(natural, frame, crop.zoom);
      const sw = frame.width / s;
      const sh = frame.height / s;
      const sx = crop.cx * natural.width - sw / 2;
      const sy = crop.cy * natural.height - sh / 2;
      const ow = Math.round(Math.min(sw, MAX_OUT, ratio >= 1 ? MAX_OUT : MAX_OUT * ratio));
      const oh = Math.round(ow / ratio);
      const canvas = document.createElement("canvas");
      canvas.width = ow;
      canvas.height = oh;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      if (look) ctx.filter = look;
      ctx.drawImage(src.img, sx, sy, sw, sh, 0, 0, ow, oh);
      const encode = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.88));
      let blob = await encode("image/webp");
      let ext = "webp";
      if (!blob || blob.type !== "image/webp") {
        blob = await encode("image/jpeg");
        ext = "jpg";
      }
      if (!blob) throw new Error("Couldn't save the edit. Try again.");
      const name = (file.name || "photo").replace(/\.[^.]+$/, "");
      onDone(new File([blob], `${name}.${ext}`, { type: blob.type }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const cancel = () => {
    if (!busy) onCancel();
  };

  return (
    <dialog
      ref={dialog}
      className="et-modal et-phed"
      aria-label="Edit photo"
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
    >
      <div className="et-modal-head">
        <div>
          <h2>Edit photo</h2>
          <p>Crop, filter and adjust it before it goes on your post.</p>
        </div>
        <button type="button" className="et-icon-btn" onClick={cancel} aria-label="Cancel" disabled={busy}>
          <X size={16} />
        </button>
      </div>

      <div className="et-phed-body">
        <div className="et-phed-stage">
          {src && natural ? (
            <Frame src={src.url} natural={natural} ratio={ratio} crop={crop} look={look} disabled={busy} onChange={setCrop} />
          ) : (
            <div className="et-phed-loading">{error || "Opening photo…"}</div>
          )}
        </div>

        <aside className="et-phed-side">
          <nav className="et-phed-tabs" role="tablist">
            {(
              [
                ["crop", "Crop", Crop],
                ["filter", "Filters", Sparkles],
                ["adjust", "Adjust", SlidersHorizontal],
              ] as const
            ).map(([key, label, Icon]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-on" : ""} onClick={() => setTab(key)}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>

          {tab === "crop" && natural && (
            <div className="et-phed-panel">
              <div className="et-phed-ratios">
                {RATIOS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={ratioKey === r.key ? "is-on" : ""}
                    onClick={() => {
                      setRatioKey(r.key);
                      setCrop(CROP_START);
                    }}
                  >
                    <i style={{ aspectRatio: String(r.ratio ?? natural.width / natural.height) }} />
                    {r.label}
                  </button>
                ))}
              </div>
              <label className="et-phed-slider">
                <span>Zoom</span>
                <span className="et-phed-range">
                  <ZoomOut size={14} />
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={crop.zoom}
                    onChange={(e) => setCrop((c) => clampCrop({ ...c, zoom: Number(e.target.value) }, natural, { width: 1000, height: 1000 / ratio }))}
                  />
                  <ZoomIn size={14} />
                </span>
              </label>
              <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={rotate} disabled={busy}>
                <RotateCw size={14} /> Rotate
              </button>
            </div>
          )}

          {tab === "filter" && src && (
            <div className="et-phed-filters">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" className={filter === f.key ? "is-on" : ""} onClick={() => setFilter(f.key)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src.url} alt="" style={{ filter: f.css || undefined }} />
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          )}

          {tab === "adjust" && (
            <div className="et-phed-panel">
              {(
                [
                  ["brightness", "Brightness"],
                  ["contrast", "Contrast"],
                  ["saturation", "Saturation"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="et-phed-slider">
                  <span>
                    {label} <em>{adjust[key] - 100 > 0 ? `+${adjust[key] - 100}` : adjust[key] - 100}</em>
                  </span>
                  <input type="range" min={50} max={150} value={adjust[key]} onChange={(e) => setAdjust((a) => ({ ...a, [key]: Number(e.target.value) }))} />
                </label>
              ))}
              <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setAdjust({ brightness: 100, contrast: 100, saturation: 100 })}>
                Reset
              </button>
            </div>
          )}
        </aside>
      </div>

      {error && src && <p className="et-flash et-flash-err" style={{ margin: "0 22px 12px" }}>{error}</p>}
      <div className="et-modal-foot">
        <button type="button" className="et-btn et-btn-ghost" onClick={cancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="et-btn et-btn-primary" onClick={done} disabled={!src || busy}>
          {busy ? "Saving…" : "Add to post"}
        </button>
      </div>
    </dialog>
  );
}

// The photo in its crop frame: drag to move it, the zoom slider (or arrow keys) to frame it.
function Frame({ src, natural, ratio, crop, look, disabled, onChange }: { src: string; natural: Size; ratio: number; crop: CropState; look: string; disabled: boolean; onChange: (c: CropState) => void }) {
  const [frame, setFrame] = useState<Size | null>(null);
  const drag = useRef<{ x: number; y: number; start: CropState } | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const measure = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(([entry]) => setFrame({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.current.observe(el);
  }, []);

  const s = frame ? cropScale(natural, frame, crop.zoom) : 0;
  const dw = natural.width * s;
  const dh = natural.height * s;
  const move = (dx: number, dy: number, from: CropState) => frame && onChange(clampCrop({ zoom: from.zoom, cx: from.cx - dx / dw, cy: from.cy - dy / dh }, natural, frame));

  return (
    <div
      ref={measure}
      className="et-crop et-phed-frame"
      style={{ aspectRatio: String(ratio) }}
      tabIndex={0}
      role="application"
      aria-label="Photo. Drag or use arrow keys to reposition."
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, start: crop };
      }}
      onPointerMove={(e) => drag.current && move(e.clientX - drag.current.x, e.clientY - drag.current.y, drag.current.start)}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 40 : 10;
        const d = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
        if (!d || disabled) return;
        e.preventDefault();
        move(d[0], d[1], crop);
      }}
    >
      {frame && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} style={{ width: dw, height: dh, left: frame.width / 2 - crop.cx * dw, top: frame.height / 2 - crop.cy * dh, filter: look || undefined }} />
      )}
      <span className="et-crop-hint">
        <Move size={13} />
        Drag to adjust
      </span>
    </div>
  );
}
