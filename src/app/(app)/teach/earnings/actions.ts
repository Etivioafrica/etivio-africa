"use server";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canEarn } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney, nairaToMinor } from "@/lib/format";
import { MIN_WITHDRAWAL_MINOR } from "@/lib/payouts";
import { featureOn } from "@/lib/data/features";

export type WithdrawState = { ok?: string; error?: string } | null;

// A withdrawal request: a pending payout to the tutor's verified bank account. The database refuses anything above
// what's available (payout_available), so two requests at once can't overdraw.
export async function requestWithdrawal(_prev: WithdrawState, fd: FormData): Promise<WithdrawState> {
  const user = await getCurrentUser();
  if (!canEarn(user.roles)) return { error: "Only tutors and coaches can withdraw earnings." };
  if (!(await featureOn("withdrawals"))) return { error: "Withdrawals aren't available right now." };
  const amount = nairaToMinor(String(fd.get("amount") ?? ""));
  if (amount < MIN_WITHDRAWAL_MINOR) return { error: `The smallest withdrawal is ${formatMoney(MIN_WITHDRAWAL_MINOR)}.` };
  const db = createAdminClient();
  const { data: account } = await db.from("payout_accounts").select("bank_name, account_number, account_name, verified_at").eq("user_id", user.id).maybeSingle();
  if (!account) return { error: "Add your bank account in Settings → Billing first." };
  if (!account.verified_at) return { error: "Your bank account isn't verified yet. Save it again in Settings → Billing." };
  const bank = `${account.bank_name} · ${account.account_number} · ${account.account_name}`;
  const { data: id, error } = await db.rpc("request_payout", { p_user: user.id, p_amount: amount, p_bank: bank });
  if (error) return { error: "We couldn't send your request. Try again." };
  if (!id) return { error: "That's more than you can withdraw right now." };
  refresh();
  return { ok: `Requested ${formatMoney(amount)}. It goes to ${account.bank_name} (${account.account_number.slice(-4).padStart(10, "•")}), usually within 2 working days.` };
}
