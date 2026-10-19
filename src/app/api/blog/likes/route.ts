import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { livePostId, readJson, validFingerprint } from "@/lib/blog-server";

async function state(postId: string, fingerprint: string) {
  const db = createAdminClient();
  const [{ count }, { data }] = await Promise.all([
    db.from("blog_likes").select("post_id", { count: "exact", head: true }).eq("post_id", postId),
    db.from("blog_likes").select("post_id").eq("post_id", postId).eq("fingerprint", fingerprint).maybeSingle(),
  ]);
  return { count: count ?? 0, liked: !!data };
}

// GET ?postId&fp: like count and whether this browser liked it.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fp = url.searchParams.get("fp");
  const postId = await livePostId(url.searchParams.get("postId"));
  if (!validFingerprint(fp) || !postId) return NextResponse.json({ count: 0, liked: false });
  return NextResponse.json(await state(postId, fp));
}

// POST { postId, fp }: toggles this browser's like.
export async function POST(req: Request) {
  const body = await readJson(req);
  const fp = body.fp;
  const postId = await livePostId(body.postId);
  if (!validFingerprint(fp) || !postId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = createAdminClient();
  const { liked } = await state(postId, fp);
  if (liked) await db.from("blog_likes").delete().eq("post_id", postId).eq("fingerprint", fp);
  else await db.from("blog_likes").insert({ post_id: postId, fingerprint: fp });
  return NextResponse.json(await state(postId, fp));
}
