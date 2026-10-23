import { NextResponse, after, type NextRequest } from "next/server";
import { fulfillOrder } from "@/lib/data/checkout";
import { remindNow } from "@/lib/data/reminders";
import { verifyTransaction } from "@/lib/paystack";

// Where Paystack sends the buyer after paying. We ask Paystack directly whether the charge succeeded; the query
// string alone is never trusted.
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trxref") ?? "";
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!/^ET[A-Z0-9]{8,40}$/.test(reference)) return to("/explore");

  const verified = await verifyTransaction(reference);
  if (verified.status && verified.data) {
    const res = await fulfillOrder(verified.data);
    if (res.destination) return to(res.destination);
  }
  // Failed or abandoned: back to checkout with a message (the cart is still there), and a reminder by email.
  after(() => remindNow(reference));
  return to("/checkout?payment=failed");
}
