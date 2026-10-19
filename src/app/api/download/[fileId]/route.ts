import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { signedDownloadUrl } from "@/lib/r2";

// GET /api/download/<file id>: checks the person owns the product (or made it, or is staff), logs the download, then
// redirects to a five-minute signed R2 link. Product files are never linked directly.
export async function GET(request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/learn/library")}`, request.url));

  const db = createAdminClient();
  const { data: file } = await db.from("product_files").select("id, product_id, file_key, file_name, product:products(creator_id)").eq("id", fileId).maybeSingle();
  if (!file) return NextResponse.json({ error: "That file no longer exists." }, { status: 404 });

  const [{ data: access }, { data: roles }] = await Promise.all([
    db.from("product_access").select("product_id").eq("user_id", user.id).eq("product_id", file.product_id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin"),
  ]);
  const allowed = !!access || file.product?.creator_id === user.id || !!roles?.length;
  if (!allowed) return NextResponse.json({ error: "You don't have access to this file." }, { status: 403 });

  await db.from("product_downloads").insert({ user_id: user.id, product_id: file.product_id, file_id: file.id });
  return NextResponse.redirect(await signedDownloadUrl(file.file_key, file.file_name));
}
