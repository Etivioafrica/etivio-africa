import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Thin Paystack client. Amounts are in kobo (our "minor" units), which is what Paystack expects for NGN.
const BASE = "https://api.paystack.co";
const secret = () => process.env.PAYSTACK_SECRET_KEY ?? "";
export const paystackReady = () => !!process.env.PAYSTACK_SECRET_KEY;

type Res<T> = { status: boolean; message: string; data?: T };

async function call<T>(path: string, init?: RequestInit): Promise<Res<T>> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  return (await res.json().catch(() => ({ status: false, message: "Paystack didn't respond." }))) as Res<T>;
}

export function initializeTransaction(input: { email: string; amountMinor: number; currency: string; reference: string; callbackUrl: string; metadata: Record<string, unknown> }) {
  return call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({ email: input.email, amount: input.amountMinor, currency: input.currency, reference: input.reference, callback_url: input.callbackUrl, metadata: input.metadata }),
  });
}

export type VerifiedTransaction = { status: string; reference: string; amount: number; currency: string; paid_at: string | null; channel: string; customer: { email: string } };

export function verifyTransaction(reference: string) {
  return call<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// Webhooks are signed with HMAC-SHA512 of the raw body using the secret key.
export function validSignature(rawBody: string, signature: string | null) {
  if (!signature || !secret()) return false;
  const expected = createHmac("sha512", secret()).update(rawBody).digest("hex");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
