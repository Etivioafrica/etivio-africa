import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { livePostId, readJson } from "@/lib/blog-server";

// POST { postId } records a view and returns its id.
// POST { postId, viewId, seconds } (sent with sendBeacon when the reader leaves) saves how long they read.
export async function POST(req: Request) {
  const body = await readJson(req);
  const postId = await livePostId(body.postId);
  if (!postId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = createAdminClient();

  if (body.viewId !== undefined) {
    const viewId = Number(body.viewId);
    const seconds = Math.round(Number(body.seconds));
    if (!Number.isInteger(viewId) || !Number.isFinite(seconds) || seconds < 3) return NextResponse.json({ ok: true });
    await db
      .from("blog_post_views")
      .update({ read_seconds: Math.min(seconds, 4 * 3600) })
      .eq("id", viewId)
      .eq("post_id", postId)
      .is("read_seconds", null)
      .gte("created_at", new Date(Date.now() - 6 * 3600_000).toISOString());
    return NextResponse.json({ ok: true });
  }

  const country = req.headers.get("x-vercel-ip-country");
  const { data } = await db
    .from("blog_post_views")
    .insert({ post_id: postId, country: country && /^[A-Z]{2}$/.test(country) ? country : null })
    .select("id")
    .single();
  return NextResponse.json({ viewId: data?.id ?? null });
}
