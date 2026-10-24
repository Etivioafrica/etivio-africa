import "server-only";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UPLOAD_KINDS, type UploadKind } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkImage, giveStrike } from "@/lib/moderation";

// Who may upload what, shared by /api/upload/sign and /api/upload/finish. Returns the user, or a response to send.
export async function uploader(kind: string): Promise<{ userId: string; kind: UploadKind } | { response: NextResponse }> {
  if (!(kind in UPLOAD_KINDS)) return { response: NextResponse.json({ error: "Unknown upload type." }, { status: 400 }) };
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  // Status 0 means the auth server couldn't be reached, not that the person is signed out.
  if (authError?.status === 0) return { response: NextResponse.json({ error: "Couldn't confirm your sign-in just now. Try again." }, { status: 503 }) };
  if (!user) return { response: NextResponse.json({ error: "Sign in to upload." }, { status: 401 }) };

  const [{ data: profile }, { data: roleRows }] = await Promise.all([supabase.rpc("my_profile").maybeSingle(), supabase.from("user_roles").select("role").eq("user_id", user.id)]);
  const roles = (roleRows ?? []).map((r) => r.role);
  const allowed =
    roles.includes("super_admin") ||
    kind === "avatar" ||
    kind === "post" ||
    kind === "banner" ||
    (roles.includes("editor") && kind === "blog") ||
    (roles.includes("tutor") && (kind === "cover" || kind === "video" || kind === "product" || kind === "document"));
  if (!allowed || profile?.status !== "active" || profile.deleted_at) return { response: NextResponse.json({ error: "You can't upload this type of file." }, { status: 403 }) };
  return { userId: user.id, kind: kind as UploadKind };
}

// Re-saves an image so nothing hidden inside it survives (scripts tacked on the end, location and camera data).
export async function cleanImage(input: Buffer, type: string) {
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

// Checks an uploaded image for nudity or sexual content before it's kept. Returns the message to show, or null when
// it's fine (or the check couldn't run: the person shouldn't be stuck because the AI is down).
export async function screenImage(userId: string, input: Buffer) {
  let small: Buffer;
  try {
    small = await sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize(384, 384, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 75 }).toBuffer();
  } catch {
    return null;
  }
  const verdict = await checkImage(small);
  if (verdict !== "explicit" && verdict !== "suggestive") return null;
  const { data: flag } = await createAdminClient()
    .from("moderation_flags")
    .insert({ target_type: "image", author_id: userId, source: "auto", reason: "sexual", details: verdict === "explicit" ? "Explicit image blocked at upload" : "Suggestive image blocked at upload", status: "blocked" })
    .select("id")
    .single();
  if (verdict === "suggestive") return "This image looks suggestive, so it can't be used on Etivio. Pick a different one.";
  const strike = await giveStrike(userId, "Uploaded an explicit image", flag?.id ?? null, null);
  return `This image breaks Etivio's rules on sexual and explicit content, so it wasn't uploaded. ${strike.message}`;
}
