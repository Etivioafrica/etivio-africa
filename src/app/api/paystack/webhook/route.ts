import { NextResponse, type NextRequest } from "next/server";
import { fulfillOrder } from "@/lib/data/checkout";
import { validSignature, verifyTransaction } from "@/lib/paystack";

// Paystack's server-to-server notice. Covers buyers who close the tab before returning to Etivio.
// Set this URL in Paystack → Settings → API Keys & Webhooks: https://etivio.co/api/paystack/webhook
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-paystack-signature"))) return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  const event = JSON.parse(raw) as { event: string; data?: { reference?: string } };
  if (event.event === "charge.success" && event.data?.reference) {
    // Re-check with Paystack rather than trusting the payload's amounts.
    const verified = await verifyTransaction(event.data.reference);
    if (verified.status && verified.data) await fulfillOrder(verified.data);
  }
  return NextResponse.json({ received: true });
}
