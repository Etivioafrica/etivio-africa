"use server";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import type { FormState } from "@/app/(app)/teach/actions";

// Give an open group more time.
export async function extendGroup(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("marketplace");
  const id = String(fd.get("id") ?? "");
  const days = Math.round(Number(fd.get("days") ?? 0));
  if (!(days >= 1 && days <= 30)) return { error: "Extend by 1 to 30 days." };
  const { data: g } = await db.from("group_buys").select("status, expires_at").eq("id", id).maybeSingle();
  if (!g || g.status !== "open") return { error: "Only open groups can be extended." };
  const from = Math.max(Date.parse(g.expires_at), Date.now());
  await db.from("group_buys").update({ expires_at: new Date(from + days * 86_400_000).toISOString() }).eq("id", id).eq("status", "open");
  await audit(admin.id, "group_buy.extend", { type: "group_buy", id }, { days });
  refresh();
  return { ok: `Extended by ${days} ${days === 1 ? "day" : "days"}.` };
}

// Close an open group now: every member's payment goes to their wallet, as if time ran out.
export async function closeGroup(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("marketplace");
  const id = String(fd.get("id") ?? "");
  const { data: g } = await db.from("group_buys").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", id).eq("status", "open").select("id").maybeSingle();
  if (!g) return { error: "Only open groups can be closed." };
  await db.rpc("expire_group_buys");
  await audit(admin.id, "group_buy.close", { type: "group_buy", id });
  refresh();
  return { ok: "Group closed. Members were credited to their wallets." };
}
