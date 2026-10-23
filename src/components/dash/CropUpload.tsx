"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Move, UploadCloud, X, ZoomIn, ZoomOut } from "lucide-react";
import { CROP_START, clampCrop, cropScale, edgeColor, exportCrop, type CropState } from "@/lib/image-crop";
import { formatBytes } from "@/lib/format";
import { uploadFile } from "@/lib/upload-client";

const MAX_SOURCE_MB = 20;
const MAX_ZOOM = 3;

type Size = { width: number; height: number };
type Picked = { file: File; preview: string; img: HTMLImageElement; fill: string };
type Stage = { label: string; progress?: number } | null;

export type CropUploadHandle = { open: () => void };

// Modal for picking an image, positioning it in a fixed-ratio frame, then uploading a cropped WebP to R2.
// `minZoom` below 1 lets people zoom out; the space is filled with the photo's edge colour.
export const CropUpload = forwardRef<
  CropUploadHandle,
  {
    title: string;
    hint: string;
    out: Size;
    kind: "banner" | "avatar" | "blog" | "cover";
    minZoom?: number;
    round?: boolean;
    confirmLabel: string;
    onUploaded: (url: string) => Promise<{ error?: string } | undefined>;
  }
>(function CropUpload({ title, hint, out, kind, minZoom = 1, round, confirmLabel, onUploaded }, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [crop, setCrop] = useState<CropState>(CROP_START);
  const [stage, setStage] = useState<Stage>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => {
      setError(null);
      dialog.current?.showModal();
    },
  }));

  // Free the local preview URL when it's replaced or the modal closes.
  useEffect(() => {
    if (!picked) return;
    return () => URL.revokeObjectURL(picked.preview);
  }, [picked]);

  function close() {
    if (stage) return;
    dialog.current?.close();
    setPicked(null);
    setError(null);
  }

  function pick(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("That isn't an image. Use a JPG, PNG, or WebP.");
    if (file.size > MAX_SOURCE_MB * 1024 * 1024) return setError(`That image is over ${MAX_SOURCE_MB} MB. Pick a smaller one.`);
    const preview = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setCrop(CROP_START);
      setPicked({ file, preview, img, fill: edgeColor(img) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(preview);
      setError("Couldn't read that image. Try another file.");
    };
    img.src = preview;
  }

  async function confirm() {
    if (!picked) return;
    setError(null);
    setStage({ label: "Optimising…" });
    let file: Awaited<ReturnType<typeof exportCrop>>;
    try {
      file = await exportCrop(picked.img, crop, out, { fill: picked.fill });
    } catch {
      setStage(null);
      return setError("Couldn't process that image. Try another file.");
    }

    const size = `${formatBytes(file.blob.size)} ${file.ext === "webp" ? "WebP" : "JPEG"}`;
    setStage({ label: `Uploading ${size}`, progress: 0 });
    let url: string;
    try {
      ({ url } = await uploadFile(kind, file.blob, `${kind}.${file.ext}`, {
        onProgress: (progress) => setStage({ label: `Uploading ${size}`, progress }),
        onChecking: () => setStage({ label: "Finishing upload…" }),
      }));
    } catch (e) {
      setStage(null);
      return setError((e as Error).message);
    }
    setStage({ label: "Saving…" });
    const res = await onUploaded(url);
    setStage(null);
    if (res?.error) return setError(res.error);
    dialog.current?.close();
    setPicked(null);
  }

  const busy = stage !== null;
  const natural = picked ? { width: picked.img.naturalWidth, height: picked.img.naturalHeight } : null;
  // Source pixels across the output width; fewer than the output means upscaling.
  const sourceWidth = natural ? Math.round(out.width / cropScale(natural, out, crop.zoom)) : 0;
  const ratio = `${out.width}/${out.height}`;

  return (
    <dialog
      ref={dialog}
      className={`et-modal${round ? " et-modal-sm" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === dialog.current && close()}
    >
      <div className="et-modal-head">
        <div>
          <h2>{title}</h2>
          <p>{picked ? `Drag to reposition. Use the slider to zoom${minZoom < 1 ? " in or out" : ""}.` : hint}</p>
        </div>
        <button type="button" className="et-icon-btn" onClick={close} aria-label="Close" disabled={busy}>
          <X size={16} />
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />

      <div className="et-modal-body">
        {picked && natural ? (
          <>
            <CropFrame picked={picked} natural={natural} crop={crop} onChange={setCrop} disabled={busy} stage={stage} ratio={ratio} round={round} />
            <div className="et-crop-zoom">
              <ZoomOut size={15} />
              <input
                type="range"
                min={minZoom}
                max={MAX_ZOOM}
                step={0.01}
                value={crop.zoom}
                disabled={busy}
                aria-label="Zoom"
                onChange={(e) => setCrop((c) => clampCrop({ ...c, zoom: Number(e.target.value) }, natural, out))}
              />
              <ZoomIn size={15} />
            </div>
            {minZoom < 1 && (
              <label className="et-crop-fill">
                <span>Background</span>
                <input type="color" value={picked.fill} disabled={busy} onChange={(e) => setPicked({ ...picked, fill: e.target.value })} />
                <small>Shows when zoomed out</small>
              </label>
            )}
            {!busy && (
              <p className="et-cover-meta">
                {picked.file.name} · {natural.width} × {natural.height} px · {formatBytes(picked.file.size)}
                {sourceWidth < out.width && crop.zoom >= 1 ? (
                  <em> · Low resolution at this zoom, so it may look soft.</em>
                ) : (
                  <>
                    {" "}
                    · Saved as a {out.width} × {out.height} WebP
                  </>
                )}
              </p>
            )}
          </>
        ) : (
          <button
            type="button"
            className={`et-cover-drop${dragging ? " is-drag" : ""}`}
            style={{ aspectRatio: round ? "16/9" : ratio }}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pick(f);
            }}
          >
            <UploadCloud size={26} strokeWidth={1.6} />
            <b>
              <u>Click to upload</u> or drag and drop
            </b>
            <small>JPG, PNG, or WebP up to {MAX_SOURCE_MB} MB</small>
          </button>
        )}
        {error && <p className="et-upload-err">{error}</p>}
      </div>

      <div className="et-modal-foot">
        {picked && !busy && (
          <button type="button" className="et-btn et-btn-ghost" onClick={() => input.current?.click()} style={{ marginRight: "auto" }}>
            Choose another
          </button>
        )}
        <button type="button" className="et-btn et-btn-ghost" onClick={close} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="et-btn et-btn-primary" onClick={confirm} disabled={!picked || busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
});

// The crop window. The image is positioned from the crop state so it stays correct at any modal width.
function CropFrame({
  picked,
  natural,
  crop,
  onChange,
  disabled,
  stage,
  ratio,
  round,
}: {
  picked: Picked;
  natural: Size;
  crop: CropState;
  onChange: (c: CropState) => void;
  disabled: boolean;
  stage: Stage;
  ratio: string;
  round?: boolean;
}) {
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

  function move(dx: number, dy: number, from: CropState) {
    if (!frame) return;
    onChange(clampCrop({ zoom: from.zoom, cx: from.cx - dx / dw, cy: from.cy - dy / dh }, natural, frame));
  }

  return (
    <div
      ref={measure}
      className={`et-crop${round ? " is-round" : ""}${disabled ? " is-busy" : ""}`}
      style={{ aspectRatio: ratio, background: picked.fill }}
      tabIndex={disabled ? -1 : 0}
      role="application"
      aria-label="Crop area. Drag or use arrow keys to reposition."
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
        <img
          src={picked.preview}
          alt="Preview"
          draggable={false}
          style={{ width: dw, height: dh, left: frame.width / 2 - crop.cx * dw, top: frame.height / 2 - crop.cy * dh }}
        />
      )}
      {!disabled && (
        <span className="et-crop-hint">
          <Move size={13} />
          Drag to adjust
        </span>
      )}
      {stage && (
        <div className="et-cover-progress">
          <span>{stage.progress !== undefined ? `${stage.label} · ${stage.progress}%` : stage.label}</span>
          {stage.progress !== undefined && (
            <span className="et-progress" style={{ width: "60%" }}>
              <span style={{ width: `${stage.progress}%` }} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
