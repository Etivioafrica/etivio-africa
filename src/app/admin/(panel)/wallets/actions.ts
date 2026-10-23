"use server";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { walletBalance } from "@/lib/data/wallet";
import { formatMoney, nairaToMinor } from "@/lib/format";
import type { FormState } from "@/app/(app)/teach/actions";

// Credit or take money from someone's wallet, with a reason they'll see in their history.
export async function adjustWallet(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("financials");
  const userId = String(fd.get("user_id") ?? "");
  const direction = fd.get("direction") === "debit" ? -1 : 1;
  const amount = nairaToMinor(String(fd.get("amount") ?? ""));
  const note = String(fd.get("note") ?? "").trim().slice(0, 200);
  if (amount <= 0) return { error: "Enter an amount." };
  if (amount > 10_000_000_00) return { error: "That's more than one adjustment can be." };
  if (note.length < 3) return { error: "Add a reason. The person sees it in their wallet history." };
  if (direction < 0 && (await walletBalance(userId)) < amount) return { error: "That's more than their balance." };
  const { error } = await db.from("wallet_transactions").insert({ user_id: userId, amount_minor: direction * amount, kind: "adjustment", note, created_by: admin.id });
  if (error) return { error: "Couldn't save the adjustment." };
  await audit(admin.id, "wallet.adjust", { type: "user", id: userId }, { amount: direction * amount, note });
  refresh();
  return { ok: `${direction > 0 ? "Added" : "Took"} ${formatMoney(amount)} ${direction > 0 ? "to" : "from"} their wallet.` };
}
