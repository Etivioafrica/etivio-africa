"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { createOrder, paystackCheckoutUrl, priceItems, type Billing, type CartRef, type PricedItem } from "@/lib/data/checkout";
import { accountIdByEmail, isEmail } from "@/lib/data/guest";
import { paystackReady } from "@/lib/paystack";

// Cart page and checkout summary: current prices and whether each item can still be bought by this visitor.
export async function priceCart(refs: CartRef[]): Promise<PricedItem[]> {
  const viewer = await sessionUser(await createClient());
  return priceItems(Array.isArray(refs) ? refs : [], viewer?.id ?? null);
}

export type PlaceOrderState = { error?: string; drop?: string[] } | null;
const str = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? "").trim().slice(0, max);

// "Pay now" on the checkout page: checks the items and billing details, records the order and opens Paystack.
// Guests get an account after payment; signed-in buyers pay with their account email.
export async function placeOrder(_prev: PlaceOrderState, fd: FormData): Promise<PlaceOrderState> {
  let refs: CartRef[] = [];
  try {
    refs = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {}
  const viewer = await sessionUser(await createClient());
  const billing: Billing = {
    firstName: str(fd, "first_name", 60),
    lastName: str(fd, "last_name", 60),
    email: viewer?.email || str(fd, "email", 200).toLowerCase(),
    phone: str(fd, "phone", 30),
    country: str(fd, "country", 60),
    state: str(fd, "state", 60),
  };
  if (!billing.firstName || !billing.lastName) return { error: "Please enter your first and last name." };
  if (!isEmail(billing.email)) return { error: "Please enter a valid email. Your receipt and login details go there." };
  if (!/^[+\d][\d\s()-]{6,}$/.test(billing.phone)) return { error: "Please enter a valid phone number." };
  if (!billing.country) return { error: "Please choose your country." };
  if (!paystackReady()) return { error: "Payments aren't available right now. Please try again later." };

  // A guest using an email that already has an account: their purchase joins that account, so skip what it owns.
  const ownerId = viewer?.id ?? (await accountIdByEmail(billing.email));
  const items = await priceItems(refs, ownerId);
  if (!items.length) return { error: "Your cart is empty." };
  const blocked = items.filter((i) => i.problem);
  if (blocked.length)
    return {
      error: blocked.some((i) => i.problem === "owned")
        ? `${viewer ? "You already have" : "That email already has"} ${blocked.map((i) => `"${i.title}"`).join(", ")}. We've taken ${blocked.length === 1 ? "it" : "them"} out of your cart.`
        : "Some items are no longer available, so we've taken them out of your cart.",
      drop: blocked.map((i) => `${i.type}:${i.id}`),
    };
  if (new Set(items.map((i) => i.currency)).size > 1) return { error: "Items in different currencies need separate orders." };

  const order = await createOrder(viewer?.id ?? null, billing, items);
  if (!order) return { error: "We couldn't start your order. Please try again." };
  const url = await paystackCheckoutUrl(order, billing, items.map((i) => i.title));
  if (!url) return { error: "We couldn't reach the payment provider. Please try again." };
  redirect(url);
}
