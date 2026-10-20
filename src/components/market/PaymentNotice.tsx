"use client";
import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, { tone: "warn" | "ok"; text: string }> = {
  failed: { tone: "warn", text: "Your payment didn't go through, so you haven't been charged. You can try again." },
  error: { tone: "warn", text: "We couldn't start checkout just now. Please try again in a moment." },
  unavailable: { tone: "warn", text: "Payments aren't switched on yet. Please check back soon." },
  cancelled: { tone: "warn", text: "Payment cancelled, so you haven't been charged. Your cart is saved whenever you're ready." },
};

// Shows the outcome of a Paystack checkout when the buyer comes back (?payment=…).
export function PaymentNotice() {
  const key = useSearchParams().get("payment") ?? "";
  const m = MESSAGES[key];
  if (!m) return null;
  return <p className={`et-flash${m.tone === "warn" ? " et-flash-warn" : ""} et-pay-notice`}>{m.text}</p>;
}
