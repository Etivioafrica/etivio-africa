import "server-only";
import { randomUUID } from "node:crypto";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { slugify } from "@/lib/format";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;
const PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, "");

// Folder and size limit per upload kind. Which file types each kind accepts lives in lib/upload-safety.ts.
export const UPLOAD_KINDS = {
  cover: { folder: "covers", maxMb: 10 },
  avatar: { folder: "avatars", maxMb: 5 },
  banner: { folder: "banners", maxMb: 5 },
  blog: { folder: "blog", maxMb: 10 },
  video: { folder: "videos", maxMb: 2048 },
  document: { folder: "documents", maxMb: 200 },
  // Marketplace files. Never linked publicly: buyers get a short-lived signed link from /api/download.
  product: { folder: "products", maxMb: 500 },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;

export function objectKey(kind: UploadKind, fileName: string) {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const base = slugify(dot > 0 ? fileName.slice(0, dot) : fileName) || "file";
  // Product files get a long random segment so their address can't be guessed.
  const stamp = kind === "product" ? randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${UPLOAD_KINDS[kind].folder}/${stamp}-${base}${ext ? `.${ext}` : ""}`;
}

export const publicUrl = (key: string) => `${PUBLIC_URL}/${key}`;

export function keyFromUrl(url: string | null) {
  return url && url.startsWith(`${PUBLIC_URL}/`) ? url.slice(PUBLIC_URL.length + 1) : null;
}

// Streams the body to R2 with multipart upload, so large videos never sit in memory. `download` stores the file so
// browsers save it instead of opening it (anything that isn't an image, video, audio or PDF).
export async function putObject(key: string, body: ReadableStream<Uint8Array> | Uint8Array, contentType: string, download?: string) {
  await new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(download ? { ContentDisposition: `attachment; filename="${download.replace(/["\\\r\n]/g, "")}"` } : {}),
    },
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
  }).done();
  return publicUrl(key);
}

export async function deleteObject(key: string | null) {
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
}

// A download link that works for a few minutes and saves the file under its original name.
export function signedDownloadUrl(key: string, fileName: string, seconds = 300) {
  const safe = fileName.replace(/["\\\r\n]/g, "");
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key, ResponseContentDisposition: `attachment; filename="${safe}"` }), { expiresIn: seconds });
}

// --- Direct uploads: the browser PUTs to a signed link under incoming/, then /api/upload/finish checks the file and
// moves it to its real folder. Vercel functions can't take request bodies over ~4.5 MB, so files never pass through.

export const INCOMING = "incoming";

export function signedUploadUrl(key: string, seconds = 900) {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: "application/octet-stream" }), { expiresIn: seconds });
}

export async function objectSize(key: string) {
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => null);
  return head?.ContentLength ?? null;
}

// The first `bytes` of an object (or all of it when `bytes` is left out).
export async function readObject(key: string, bytes?: number) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key, ...(bytes ? { Range: `bytes=0-${bytes - 1}` } : {}) }));
  return Buffer.from(await res.Body!.transformToByteArray());
}

// Copies within the bucket (up to 5 GB) with the real content type, and `download` set as for putObject.
export async function copyObject(from: string, to: string, contentType: string, download?: string) {
  await s3.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${from.split("/").map(encodeURIComponent).join("/")}`,
      Key: to,
      MetadataDirective: "REPLACE",
      ContentType: contentType,
      ...(download ? { ContentDisposition: `attachment; filename="${download.replace(/["\\\r\n]/g, "")}"` } : {}),
    }),
  );
  return publicUrl(to);
}
