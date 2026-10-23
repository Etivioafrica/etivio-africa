"use server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createTopupOrder, paystackCheckoutUrl } from "@/lib/data/checkout";
import { TOPUP_MAX_MINOR, TOPUP_MIN_MINOR } from "@/lib/data/wallet";
import { formatMoney, nairaToMinor } from "@/lib/format";
import { paystackReady } from "@/lib/paystack";

export type TopUpState = { error?: string } | null;

// "Add money": an order for the amount, paid on Paystack. The wallet is credited once Paystack confirms it.
export async function topUpWallet(_prev: TopUpState, fd: FormData): Promise<TopUpState> {
  const user = await getCurrentUser();
  const amount = nairaToMinor(String(fd.get("amount") ?? ""));
  if (amount < TOPUP_MIN_MINOR) return { error: `The smallest top-up is ${formatMoney(TOPUP_MIN_MINOR)}.` };
  if (amount > TOPUP_MAX_MINOR) return { error: `The largest top-up is ${formatMoney(TOPUP_MAX_MINOR)} at a time.` };
  if (!paystackReady()) return { error: "Payments aren't available right now. Please try again later." };
  const [firstName = "Etivio", ...rest] = (user.name || user.email.split("@")[0]).trim().split(/\s+/);
  const billing = { firstName, lastName: rest.join(" ") || "Learner", email: user.email, phone: "", country: "", state: "" };
  const order = await createTopupOrder(user.id, billing, amount);
  if (!order) return { error: "We couldn't start your top-up. Please try again." };
  const url = await paystackCheckoutUrl(order, billing, ["Etivio wallet top-up"]);
  if (!url) return { error: "We couldn't reach the payment provider. Please try again." };
  redirect(url);
}
