"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionUser } from "@/lib/supabase/session";
import { featureOn } from "@/lib/data/features";
import { getCoach, holdSession, sessionOrder, sessionPaid, slotIsFree } from "@/lib/data/coaching";
import { walletBalance } from "@/lib/data/wallet";
import { initializeTransaction, paystackReady } from "@/lib/paystack";
import { siteUrl } from "@/lib/email/site";

export type BookState = { error?: string } | null;

// Holds the chosen time, then pays: all from the wallet if it covers the price (and they chose it), otherwise
// Paystack. Free sessions are confirmed straight away.
export async function bookSession(_prev: BookState, fd: FormData): Promise<BookState> {
  const slug = String(fd.get("slug") ?? "");
  const startsAt = String(fd.get("starts_at") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 1000) || null;
  const useWallet = fd.get("wallet") === "1";
  const viewer = await sessionUser(await createClient());
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/coaches/${slug}`)}`);
  if (!(await featureOn("coaching"))) return { error: "Booking isn't available right now." };

  const coach = await getCoach(slug, viewer.id);
  if (!coach || coach.status !== "live") return { error: "This coach isn't taking bookings right now." };
  if (coach.user_id === viewer.id) return { error: "You can't book a session with yourself." };
  if (!(await slotIsFree(coach, startsAt))) return { error: "That time was just taken. Please pick another." };

  const wallet = coach.price_minor > 0 && useWallet ? await walletBalance(viewer.id) : 0;
  const fromWallet = wallet >= coach.price_minor ? coach.price_minor : 0;
  if (coach.price_minor > 0 && !fromWallet && !paystackReady()) return { error: "Payments aren't available right now. Please try again later." };

  const booking = await holdSession(coach, viewer.id, startsAt, note);
  if (!booking) return { error: "That time was just taken. Please pick another." };

  const { data: profile } = await createAdminClient().from("profiles").select("full_name").eq("id", viewer.id).maybeSingle();
  const [firstName = "Etivio", ...rest] = (profile?.full_name || viewer.email.split("@")[0]).trim().split(/\s+/);
  const order = await sessionOrder(booking, coach, { id: viewer.id, email: viewer.email, firstName, lastName: rest.join(" ") || "Learner" }, fromWallet);
  if (!order) {
    await createAdminClient().from("coach_bookings").update({ status: "cancelled", cancel_reason: "Not paid in time", cancelled_at: new Date().toISOString() }).eq("id", booking.id);
    return { error: "We couldn't start your booking. Please try again." };
  }

  if (order.total_minor === 0) {
    const db = createAdminClient();
    if (fromWallet) {
      const { data: spent } = await db.rpc("spend_wallet", { p_user: viewer.id, p_amount: fromWallet, p_order: order.id });
      if (!spent) {
        await db.from("coach_bookings").update({ status: "cancelled", cancel_reason: "Not paid in time", cancelled_at: new Date().toISOString() }).eq("id", booking.id);
        return { error: "Your wallet balance is too low for this session." };
      }
    }
    const paidAt = new Date().toISOString();
    await db.from("orders").update({ status: "success", paid_at: paidAt }).eq("id", order.id).eq("status", "pending");
    await sessionPaid(order.id, paidAt);
    redirect("/learn/sessions?booked=1");
  }

  const site = siteUrl();
  const init = await initializeTransaction({
    email: viewer.email,
    amountMinor: order.total_minor,
    currency: order.currency,
    reference: order.reference,
    callbackUrl: `${site}/api/paystack/callback`,
    metadata: {
      order_id: order.id,
      cancel_action: `${site}/coaches/${slug}`,
      custom_fields: [{ display_name: "Session", variable_name: "session", value: `Coaching with ${coach.name}` }],
    },
  });
  if (!init.status || !init.data) return { error: "We couldn't reach the payment provider. Please try again." };
  redirect(init.data.authorization_url);
}
