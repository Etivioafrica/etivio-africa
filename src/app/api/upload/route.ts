import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { UPLOAD_KINDS, objectKey, putObject, type UploadKind } from "@/lib/r2";
import { checkUpload } from "@/lib/upload-safety";

// Raw-body upload: POST /api/upload?kind=cover with the file as the body.
// Excluded from the proxy matcher so large bodies stream straight through to R2.

const HEAD_BYTES = 4100;

// Splits off the first few KB (to identify the file) and returns a stream that still yields every byte, failing if
// more than `max` bytes arrive (the Content-Length header can't be trusted).
async function splitHead(body: ReadableStream<Uint8Array>, max: number) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let read = 0;
  while (read < HEAD_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    read += value.length;
  }
  const first = new Uint8Array(read);
  let o = 0;
  for (const c of chunks) {
    first.set(c, o);
    o += c.length;
  }
  let total = first.length;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (total > max) return controller.error(new Error("too large"));
      if (first.length) controller.enqueue(first);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) return controller.close();
      total += value.length;
      if (total > max) {
        await reader.cancel();
        return controller.error(new Error("too large"));
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return { head: first.subarray(0, HEAD_BYTES), stream, size: () => total };
}

async function toBuffer(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

// Re-saves an image so nothing hidden inside it survives (scripts tacked on the end, location and camera data).
async function cleanImage(input: Buffer, type: string) {
  const animated = type === "image/gif" || type === "image/webp";
  // limitInputPixels stops "decompression bomb" images that are tiny files but enormous when opened.
  let img = sharp(input, { animated, limitInputPixels: 40_000_000 });
  if (!animated) img = img.rotate();
  if (type === "image/png") return img.png({ compressionLevel: 9 }).toBuffer();
  if (type === "image/gif") return img.gif().toBuffer();
  if (type === "image/webp") return img.webp({ quality: 88 }).toBuffer();
  if (type === "image/avif") return img.avif({ quality: 60 }).toBuffer();
  return img.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

export async function POST(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") as UploadKind;
  const spec = UPLOAD_KINDS[kind];
  if (!spec) return NextResponse.json({ error: "Unknown upload type." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  // Status 0 means the auth server couldn't be reached, not that the person is signed out.
  if (authError?.status === 0) return NextResponse.json({ error: "Couldn't confirm your sign-in just now. Try again." }, { status: 503 });
  if (!user) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.rpc("my_profile").maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const roles = (roleRows ?? []).map((r) => r.role);
  const allowed =
    roles.includes("super_admin") ||
    kind === "avatar" ||
    kind === "banner" ||
    (roles.includes("editor") && kind === "blog") ||
    (roles.includes("tutor") && (kind === "cover" || kind === "video" || kind === "product"));
  if (!allowed || profile?.status !== "active" || profile.deleted_at) return NextResponse.json({ error: "You can't upload this type of file." }, { status: 403 });

  const max = spec.maxMb * 1024 * 1024;
  const claimed = Number(request.headers.get("content-length") || 0);
  const name = decodeURIComponent(request.headers.get("x-file-name") || "file").slice(0, 200);
  if (claimed > max) return NextResponse.json({ error: `Files here can be up to ${spec.maxMb} MB.` }, { status: 413 });
  if (!request.body) return NextResponse.json({ error: "Empty upload." }, { status: 400 });

  const { head, stream, size } = await splitHead(request.body, max);
  if (!head.length) return NextResponse.json({ error: "Empty upload." }, { status: 400 });
  const verdict = checkUpload(kind, name, head);
  if (!verdict.ok) {
    await stream.cancel().catch(() => {});
    return NextResponse.json({ error: verdict.error }, { status: 415 });
  }

  // Keep the person's file name, but with the extension that matches what's really inside.
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  const safeName = `${base || "file"}.${verdict.ext}`;
  const key = objectKey(kind, safeName);
  const inline = verdict.family === "image" || verdict.family === "video" || verdict.family === "audio" || verdict.family === "pdf";

  try {
    if (verdict.family === "image" && kind !== "product" && kind !== "document") {
      let cleaned: Buffer;
      try {
        cleaned = await cleanImage(await toBuffer(stream), verdict.type);
      } catch (e) {
        if ((e as Error).message === "too large") throw e;
        return NextResponse.json({ error: "We couldn't read this image. Try saving it again as JPG or PNG." }, { status: 415 });
      }
      const url = await putObject(key, cleaned, verdict.type);
      return NextResponse.json({ url, key, name: safeName, size: cleaned.length, type: verdict.type });
    }
    const url = await putObject(key, stream, verdict.type, inline ? undefined : safeName);
    return NextResponse.json({ url, key, name: safeName, size: size(), type: verdict.type });
  } catch (e) {
    if ((e as Error).message === "too large") return NextResponse.json({ error: `Files here can be up to ${spec.maxMb} MB.` }, { status: 413 });
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 502 });
  }
}
