"use server";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { HIDE_AT_REPORTS, REASON_LABELS, loadTarget, reportable, setHidden, type Reason } from "@/lib/moderation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Someone pressed Report. One report per person per thing; enough reports hide it until staff decide.
export async function reportContent(type: string, id: string, reason: string, details: string): Promise<{ ok?: string; error?: string }> {
  const user = await sessionUser(await createClient());
  if (!user) return { error: "Sign in to report something." };
  if (!reportable(type) || !UUID.test(id)) return { error: "That can't be reported." };
  const why = (Object.keys(REASON_LABELS) as Reason[]).find((r) => r === reason);
  if (!why) return { error: "Pick a reason." };
  const target = await loadTarget(type, id);
  if (!target) return { error: "That's no longer there." };
  if (target.authorId === user.id) return { error: "You can't report your own post." };

  const db = createAdminClient();
  // Messages are private: only the two people in the conversation can report one.
  if (type === "message") {
    const { data: c } = await db.from("conversations").select("student_id, tutor_id").eq("id", String(target.row.conversation_id)).maybeSingle();
    if (!c || (c.student_id !== user.id && c.tutor_id !== user.id)) return { error: "That can't be reported." };
  }

  const { error } = await db.from("moderation_flags").insert({
    target_type: type,
    target_id: id,
    author_id: target.authorId,
    excerpt: target.text.slice(0, 600),
    link: target.link,
    source: "report",
    reason: why,
    details: details.trim().slice(0, 500) || null,
    reporter_id: user.id,
  });
  if (error?.code === "23505") return { ok: "You've already reported this. The team will look at it." };
  if (error) return { error: "Couldn't send your report. Try again." };

  const { count } = await db.from("moderation_flags").select("id", { count: "exact", head: true }).eq("target_type", type).eq("target_id", id).eq("source", "report").eq("status", "open");
  if ((count ?? 0) >= HIDE_AT_REPORTS) await setHidden(type, id, true);
  return { ok: "Thanks for telling us. The Etivio team will look at it." };
}
