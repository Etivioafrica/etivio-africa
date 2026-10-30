import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The Etivio wallet: a ledger of credits (group buys that didn't fill, top-ups, invite rewards, admin credits) and spending (paid
// orders). The balance is the sum. Spending only happens through spend_wallet (migration 0041), which checks it.

export const TOPUP_MIN_MINOR = 500_00;
export const TOPUP_MAX_MINOR = 1_000_000_00;

export async function walletBalance(userId: string) {
  const { data } = await createAdminClient().rpc("wallet_balance", { p_user: userId });
  return Number(data ?? 0);
}

export type WalletEntry = { id: number; amountMinor: number; kind: string; note: string | null; at: string; orderRef: string | null };

export async function walletHistory(userId: string, limit = 50): Promise<WalletEntry[]> {
  const { data } = await createAdminClient()
    .from("wallet_transactions")
    .select("id, amount_minor, kind, note, created_at, order:orders(reference)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((t) => ({ id: t.id, amountMinor: t.amount_minor, kind: t.kind, note: t.note, at: t.created_at, orderRef: t.order?.reference ?? null }));
}

export const WALLET_KIND_LABEL: Record<string, string> = {
  group_refund: "Group buy credit",
  topup: "Top-up",
  spend: "Spent at checkout",
  adjustment: "Adjustment by Etivio",
  referral: "Invite reward",
};
