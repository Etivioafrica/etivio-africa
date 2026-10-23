import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { INCOMING, UPLOAD_KINDS, signedUploadUrl } from "@/lib/r2";
import { checkName } from "@/lib/upload-safety";
import { uploader } from "@/lib/upload-server";

// POST /api/upload/sign { kind, name, size }: a 15-minute link the browser PUTs the file to. The file lands under
// incoming/<user>/ and isn't used anywhere until /api/upload/finish has checked it.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { kind?: string; name?: string; size?: number };
  const who = await uploader(String(body.kind));
  if ("response" in who) return who.response;
  const spec = UPLOAD_KINDS[who.kind];
  const name = String(body.name || "file").slice(0, 200);
  if (!body.size || body.size <= 0) return NextResponse.json({ error: "Empty upload." }, { status: 400 });
  if (body.size > spec.maxMb * 1024 * 1024) return NextResponse.json({ error: `Files here can be up to ${spec.maxMb} MB.` }, { status: 413 });
  const problem = checkName(who.kind, name);
  if (problem) return NextResponse.json({ error: problem }, { status: 415 });
  const key = `${INCOMING}/${who.userId}/${randomUUID()}`;
  return NextResponse.json({ key, url: await signedUploadUrl(key) });
}
