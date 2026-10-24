import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { livePostId, readJson } from "@/lib/blog-server";
import { moderate } from "@/lib/moderation";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// POST { postId, name, email?, content, website }: a new comment, hidden until an admin approves it.
// `website` is a hidden honeypot field; bots fill it, people don't.
export async function POST(req: Request) {
  const body = await readJson(req);
  if (typeof body.website === "string" && body.website) return NextResponse.json({ ok: true });
  const postId = await livePostId(body.postId);
  if (!postId) return NextResponse.json({ error: "That post isn't available." }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const db = createAdminClient();
  const profile = user ? (await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle()).data : null;

  const name = String(body.name ?? "").trim().slice(0, 80) || profile?.full_name || "";
  const email = String(body.email ?? "").trim().slice(0, 200) || user?.email || "";
  const content = String(body.content ?? "").trim();
  if (!name) return NextResponse.json({ error: "Add your name." }, { status: 400 });
  if (content.length < 2) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });
  if (content.length > 2000) return NextResponse.json({ error: "Keep comments under 2,000 characters." }, { status: 400 });
  if (email && !EMAIL.test(email)) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });

  // Slow down floods: at most 5 comments on a post from the same email in 10 minutes.
  if (email) {
    const { count } = await db
      .from("blog_comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId)
      .eq("author_email", email)
      .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
    if ((count ?? 0) >= 5) return NextResponse.json({ error: "You've commented a lot just now. Try again in a few minutes." }, { status: 429 });
  }

  const check = await moderate("blog_comment", user?.id ?? null, [name, content], "/admin/blog/comments");
  if (check.error) return NextResponse.json({ error: check.error }, { status: 422 });
  const { data, error } = await db.from("blog_comments").insert({ post_id: postId, user_id: user?.id ?? null, author_name: name, author_email: email || null, content }).select("id").single();
  if (error) return NextResponse.json({ error: "Couldn't post your comment. Try again." }, { status: 500 });
  await check.record(data?.id);
  return NextResponse.json({ ok: true }, { status: 201 });
}
