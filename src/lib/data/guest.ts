import "server-only";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Accounts for people who bought without signing in. The payment carries their name and email until Paystack
// confirms it; then they get an account (or the one they already have) and an email with a temporary password.

// No look-alike characters (0/O, 1/l/I), so it's easy to type from an email.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function temporaryPassword(length = 12) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 200;

export async function accountIdByEmail(email: string): Promise<string | null> {
  const { data } = await createAdminClient().rpc("user_id_by_email", { p_email: email });
  return data ?? null;
}

export type GuestAccount = { userId: string; created: boolean; password: string | null };

// Finds or creates the buyer's account. New accounts are confirmed straight away (paying proves the email works
// well enough, and Paystack sends a receipt there) and must choose their own password at first sign-in.
export async function accountForGuest(email: string, name: string): Promise<GuestAccount | null> {
  const existing = await accountIdByEmail(email);
  if (existing) return { userId: existing, created: false, password: null };
  const db = createAdminClient();
  const password = temporaryPassword();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
    app_metadata: { must_set_password: true, created_by: "guest_checkout" },
  });
  if (data?.user) return { userId: data.user.id, created: true, password };
  // Created by a parallel request (callback and webhook racing): use that account.
  const raced = error ? await accountIdByEmail(email) : null;
  return raced ? { userId: raced, created: false, password: null } : null;
}

// "nnamdi@gmail.com" -> "nn****@gmail.com", for showing which inbox to check without echoing the full address.
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(2, user.length - 2))}@${domain}`;
}
