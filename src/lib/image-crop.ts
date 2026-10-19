// Crop + compress images in the browser before they go to R2.

// Where the crop frame sits on the image: zoom 1 = image just covers the frame (below 1 leaves space around it),
// cx/cy = the image point (0..1) at the frame's centre.
export type CropState = { zoom: number; cx: number; cy: number };

export const CROP_START: CropState = { zoom: 1, cx: 0.5, cy: 0.5 };

type Size = { width: number; height: number };

// Scale that makes the image just cover a frame of the given size, times zoom.
export function cropScale(img: Size, frame: Size, zoom: number) {
  return Math.max(frame.width / img.width, frame.height / img.height) * zoom;
}

// Zoomed in: keep the image filling the frame. Zoomed out: keep the whole image inside the frame.
export function clampCrop(c: CropState, img: Size, frame: Size): CropState {
  const s = cropScale(img, frame, c.zoom);
  const halfX = frame.width / 2 / s / img.width;
  const halfY = frame.height / 2 / s / img.height;
  const clamp = (v: number, h: number) => Math.min(Math.max(h, 1 - h), Math.max(Math.min(h, 1 - h), v));
  return { zoom: c.zoom, cx: clamp(c.cx, halfX), cy: clamp(c.cy, halfY) };
}

// Average colour of the image's top edge, used to fill the space when zoomed out (usually the backdrop).
export function edgeColor(img: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, img.naturalWidth, Math.max(1, img.naturalHeight * 0.02), 0, 0, 32, 1);
  const d = ctx.getImageData(0, 0, 32, 1).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const hex = (v: number) => Math.round(v / 32).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// Draws the crop at `out` size and encodes WebP, falling back to JPEG where the browser can't encode WebP.
export async function exportCrop(
  img: HTMLImageElement,
  crop: CropState,
  out: Size,
  opts: { quality?: number; fill?: string } = {},
): Promise<{ blob: Blob; type: string; ext: string }> {
  const natural = { width: img.naturalWidth, height: img.naturalHeight };
  const s = cropScale(natural, out, crop.zoom);
  const w = natural.width * s;
  const h = natural.height * s;

  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = opts.fill ?? "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, out.width / 2 - crop.cx * w, out.height / 2 - crop.cy * h, w, h);

  const quality = opts.quality ?? 0.82;
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, type: "image/webp", ext: "webp" };
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("Could not process this image.");
  return { blob: jpeg, type: "image/jpeg", ext: "jpg" };
}
