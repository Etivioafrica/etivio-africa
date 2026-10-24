"use server";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { giveStrike, removeTarget, setHidden, TARGET_LABELS, type TargetType } from "@/lib/moderation";

// Decides everything reported or caught about one thing: remove it (and give its author a strike) or keep it.
export async function decideFlag(flagId: string, decision: "remove" | "keep", strike: boolean): Promise<{ ok?: string; error?: string }> {
  const { admin, db } = await requireAdmin("moderation");
  const { data: flag } = await db.from("moderation_flags").select("id, target_type, target_id, author_id, status, reason").eq("id", flagId).maybeSingle();
  if (!flag || flag.status !== "open") return { error: "This has already been dealt with." };
  const type = flag.target_type as TargetType;
  const now = new Date().toISOString();
  const status = decision === "remove" ? "removed" : "dismissed";

  // Close every open flag on the same thing, so it isn't decided twice.
  const same = flag.target_id
    ? db.from("moderation_flags").update({ status, resolved_by: admin.id, resolved_at: now }).eq("target_type", type).eq("target_id", flag.target_id).eq("status", "open")
    : db.from("moderation_flags").update({ status, resolved_by: admin.id, resolved_at: now }).eq("id", flag.id);
  await same;

  let message = decision === "remove" ? `${TARGET_LABELS[type]} removed.` : "Kept. It's visible again.";
  if (flag.target_id) {
    if (decision === "remove") await removeTarget(type, flag.target_id);
    else await setHidden(type, flag.target_id, false);
  }
  if (decision === "remove" && strike && flag.author_id) {
    const res = await giveStrike(flag.author_id, `${TARGET_LABELS[type]} removed (${flag.reason})`, flag.id, admin.id);
    message += ` The author now has ${res.strikes} ${res.strikes === 1 ? "strike" : "strikes"}.`;
  }
  await audit(admin.id, `moderation.${decision}`, { type, id: flag.target_id ?? flag.id }, { strike });
  refresh();
  return { ok: message };
}

// Wipes a person's strikes and lets them post again (for a mistake, or after an appeal).
export async function clearStrikes(userId: string): Promise<{ ok?: string; error?: string }> {
  const { admin, db } = await requireAdmin(["moderation", "users"]);
  await db.from("user_strikes").delete().eq("user_id", userId);
  await db.from("profiles").update({ strikes: 0, muted_until: null }).eq("id", userId);
  await audit(admin.id, "moderation.clear_strikes", { type: "user", id: userId });
  refresh();
  return { ok: "Strikes cleared. They can post again." };
}
