import "server-only";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

export const UPLOAD_KINDS = {
  cover: { folder: "covers", maxMb: 10, types: /^image\// },
  avatar: { folder: "avatars", maxMb: 5, types: /^image\// },
  blog: { folder: "blog", maxMb: 10, types: /^image\// },
  video: { folder: "videos", maxMb: 2048, types: /^video\// },
  document: { folder: "documents", maxMb: 200, types: /.*/ },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;

export function objectKey(kind: UploadKind, fileName: string) {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const base = slugify(dot > 0 ? fileName.slice(0, dot) : fileName) || "file";
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${UPLOAD_KINDS[kind].folder}/${stamp}-${base}${ext ? `.${ext}` : ""}`;
}

export const publicUrl = (key: string) => `${PUBLIC_URL}/${key}`;

export function keyFromUrl(url: string | null) {
  return url && url.startsWith(`${PUBLIC_URL}/`) ? url.slice(PUBLIC_URL.length + 1) : null;
}

// Streams the body to R2 with multipart upload, so large videos never sit in memory.
export async function putObject(key: string, body: ReadableStream<Uint8Array>, contentType: string) {
  await new Upload({
    client: s3,
    params: { Bucket: BUCKET, Key: key, Body: body, ContentType: contentType },
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
  }).done();
  return publicUrl(key);
}

export async function deleteObject(key: string | null) {
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
}
