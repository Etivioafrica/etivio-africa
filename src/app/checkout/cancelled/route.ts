import { NextResponse, after, type NextRequest } from "next/server";
import { remindNow } from "@/lib/data/reminders";

// Paystack sends buyers here when they cancel on its checkout page. Their cart is still saved in the browser; the
// first reminder email goes out straight away.
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("order") ?? "";
  after(() => remindNow(reference));
  return NextResponse.redirect(new URL("/checkout?payment=cancelled", request.url));
}
