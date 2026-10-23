import { NextResponse, type NextRequest } from "next/server";
import { INCOMING, UPLOAD_KINDS, copyObject, deleteObject, objectKey, objectSize, putObject, readObject } from "@/lib/r2";
import { checkUpload } from "@/lib/upload-safety";
import { cleanImage, uploader } from "@/lib/upload-server";

// POST /api/upload/finish { kind, key, name }: checks a file the browser just sent to R2 (size, then what it really
// is from its first bytes), cleans images, and moves it to its folder. Anything that fails is deleted.
export const maxDuration = 60;

const HEAD_BYTES = 4100;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { kind?: string; key?: string; name?: string };
  const who = await uploader(String(body.kind));
  if ("response" in who) return who.response;
  const incoming = String(body.key || "");
  if (!new RegExp(`^${INCOMING}/${who.userId}/[0-9a-f-]{36}$`).test(incoming)) return NextResponse.json({ error: "Upload not found." }, { status: 400 });

  const spec = UPLOAD_KINDS[who.kind];
  const fail = async (error: string, status: number) => {
    await deleteObject(incoming);
    return NextResponse.json({ error }, { status });
  };
  const size = await objectSize(incoming);
  if (size === null) return NextResponse.json({ error: "The upload didn't arrive. Try again." }, { status: 400 });
  if (size === 0) return fail("Empty upload.", 400);
  if (size > spec.maxMb * 1024 * 1024) return fail(`Files here can be up to ${spec.maxMb} MB.`, 413);

  const name = String(body.name || "file").slice(0, 200);
  const verdict = checkUpload(who.kind, name, await readObject(incoming, Math.min(HEAD_BYTES, size)));
  if (!verdict.ok) return fail(verdict.error, 415);

  // Keep the person's file name, but with the extension that matches what's really inside.
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  const safeName = `${base || "file"}.${verdict.ext}`;
  const key = objectKey(who.kind, safeName);
  const inline = verdict.family === "image" || verdict.family === "video" || verdict.family === "audio" || verdict.family === "pdf";

  try {
    if (verdict.family === "image" && who.kind !== "product" && who.kind !== "document") {
      let cleaned: Buffer;
      try {
        cleaned = await cleanImage(await readObject(incoming), verdict.type);
      } catch {
        return fail("We couldn't read this image. Try saving it again as JPG or PNG.", 415);
      }
      const url = await putObject(key, cleaned, verdict.type);
      await deleteObject(incoming);
      return NextResponse.json({ url, key, name: safeName, size: cleaned.length, type: verdict.type });
    }
    const url = await copyObject(incoming, key, verdict.type, inline ? undefined : safeName);
    await deleteObject(incoming);
    return NextResponse.json({ url, key, name: safeName, size, type: verdict.type });
  } catch {
    return fail("Upload failed. Try again.", 502);
  }
}
