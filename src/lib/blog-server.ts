import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The id back when it belongs to a post readers can see right now, otherwise null.
export async function livePostId(id: unknown): Promise<string | null> {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const { data } = await createAdminClient()
    .from("blog_posts")
    .select("id")
    .eq("id", id)
    .neq("status", "draft")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  return data ? id : null;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (text.length > 10_000) return {};
    const body = JSON.parse(text);
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export const validFingerprint = (fp: unknown): fp is string => typeof fp === "string" && /^[a-z0-9-]{8,64}$/i.test(fp);
