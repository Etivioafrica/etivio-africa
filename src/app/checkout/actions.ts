"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { alreadyOwns, checkoutItem, createPendingPayment } from "@/lib/data/checkout";
import { initializeTransaction, paystackReady } from "@/lib/paystack";
import { siteUrl } from "@/lib/email/site";

// "Buy now" on a course or product page: records a pending payment, then hands over to Paystack's checkout.
export async function startCheckout(fd: FormData) {
  const type = fd.get("type") === "course" ? "course" : "product";
  const slug = String(fd.get("slug") ?? "");
  const page = type === "course" ? `/courses/${slug}` : `/products/${slug}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect(`/login?next=${encodeURIComponent(page)}`);

  const item = await checkoutItem(type, slug);
  if (!item || item.priceMinor <= 0) redirect(page);
  if (await alreadyOwns(user.id, item)) redirect(type === "course" ? `/learn/course/${item.id}` : "/learn/library");
  if (!paystackReady()) redirect(`${page}?payment=unavailable`);

  const payment = await createPendingPayment(user.id, item);
  if (!payment) redirect(`${page}?payment=error`);
  const init = await initializeTransaction({
    email: user.email,
    amountMinor: item.priceMinor,
    currency: item.currency,
    reference: payment.reference,
    callbackUrl: `${siteUrl()}/api/paystack/callback`,
    metadata: { payment_id: payment.id, user_id: user.id, item_type: type, item_id: item.id, item_title: item.title, cancel_action: `${siteUrl()}${page}` },
  });
  if (!init.status || !init.data) redirect(`${page}?payment=error`);
  redirect(init.data.authorization_url);
}
