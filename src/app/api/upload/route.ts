import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UPLOAD_KINDS, objectKey, putObject, type UploadKind } from "@/lib/r2";

// Raw-body upload: POST /api/upload?kind=cover with the file as the body.
// Excluded from the proxy matcher so large bodies stream straight through to R2.
export async function POST(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") as UploadKind;
  const spec = UPLOAD_KINDS[kind];
  if (!spec) return NextResponse.json({ error: "Unknown upload type." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("status, deleted_at").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const roles = (roleRows ?? []).map((r) => r.role);
  const allowed =
    roles.includes("super_admin") ||
    kind === "avatar" ||
    (roles.includes("editor") && kind === "blog") ||
    (roles.includes("tutor") && (kind === "cover" || kind === "video"));
  if (!allowed || profile?.status !== "active" || profile.deleted_at) return NextResponse.json({ error: "You can't upload this type of file." }, { status: 403 });

  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const size = Number(request.headers.get("content-length") || 0);
  const name = decodeURIComponent(request.headers.get("x-file-name") || "file");
  if (!spec.types.test(contentType)) return NextResponse.json({ error: "That file type isn't allowed here." }, { status: 415 });
  if (size > spec.maxMb * 1024 * 1024) return NextResponse.json({ error: `Files here can be up to ${spec.maxMb} MB.` }, { status: 413 });
  if (!request.body) return NextResponse.json({ error: "Empty upload." }, { status: 400 });

  const key = objectKey(kind, name);
  try {
    const url = await putObject(key, request.body, contentType);
    return NextResponse.json({ url, key, name, size, type: contentType });
  } catch {
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 502 });
  }
}
