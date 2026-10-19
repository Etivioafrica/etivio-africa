import { NextResponse, type NextRequest } from "next/server";
import { fulfillPayment } from "@/lib/data/checkout";
import { verifyTransaction } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

// Where Paystack sends the buyer after paying. We ask Paystack directly whether the charge succeeded; the query
// string alone is never trusted.
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trxref") ?? "";
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!/^ET[A-Z0-9]{8,40}$/.test(reference)) return to("/explore");

  const verified = await verifyTransaction(reference);
  if (verified.status && verified.data) {
    const res = await fulfillPayment(verified.data);
    if (res.ok && res.destination) return to(res.destination);
  }
  // Failed or abandoned: send them back to the item with a message.
  const { data: pay } = await createAdminClient().from("payments").select("course:courses(slug), product:products(slug)").eq("reference", reference).maybeSingle();
  const page = pay?.course ? `/courses/${pay.course.slug}` : pay?.product ? `/products/${pay.product.slug}` : "/explore";
  return to(`${page}?payment=failed`);
}
