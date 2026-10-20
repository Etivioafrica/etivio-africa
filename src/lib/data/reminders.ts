import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailCheckoutReminder } from "@/lib/email/notify";
import { verifyTransaction } from "@/lib/paystack";
import { fulfillOrder } from "./checkout";

// Abandoned-checkout reminders: up to 4 emails over 2 days for an order that was started but not paid.
// The first goes straight away when Paystack reports a failed or cancelled payment, otherwise 30 minutes after the
// order was started; the rest go roughly 6, 24 and 47 hours after it was started.
const DUE_AFTER_MIN = [30, 6 * 60, 24 * 60, 47 * 60];
export const MAX_REMINDERS = DUE_AFTER_MIN.length;
const WINDOW_HOURS = 50;

type PendingOrder = { id: string; reference: string; email: string; created_at: string; reminders_sent: number };

// Claims reminder `n + 1` for an order (so two runs can't both send it), then sends it. Before emailing, asks
// Paystack about the order: if it was actually paid and the webhook was missed, this fulfils it instead.
async function remind(order: PendingOrder) {
  const db = createAdminClient();
  const verified = await verifyTransaction(order.reference);
  if (verified.status && verified.data?.status === "success") {
    await fulfillOrder(verified.data);
    return false;
  }
  // Stop if the same person has since bought in another order.
  const { count: laterPaid } = await db.from("orders").select("id", { count: "exact", head: true }).eq("email", order.email).eq("status", "success").gt("created_at", order.created_at);
  if (laterPaid) {
    await db.from("orders").update({ reminders_sent: MAX_REMINDERS }).eq("id", order.id);
    return false;
  }
  const { data: claimed } = await db
    .from("orders")
    .update({ reminders_sent: order.reminders_sent + 1, last_reminded_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("reminders_sent", order.reminders_sent)
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (!claimed) return false;
  await emailCheckoutReminder(order.id, order.reminders_sent + 1);
  return true;
}

// Run on a schedule (see /api/cron/checkout-reminders). Sends every reminder that has come due.
export async function sendDueReminders() {
  const db = createAdminClient();
  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();
  const { data } = await db
    .from("orders")
    .select("id, reference, email, created_at, reminders_sent")
    .in("status", ["pending", "failed"])
    .lt("reminders_sent", MAX_REMINDERS)
    .gte("created_at", since)
    .order("created_at")
    .limit(100);
  let sent = 0;
  for (const o of data ?? []) {
    const age = (Date.now() - Date.parse(o.created_at)) / 60_000;
    if (age < DUE_AFTER_MIN[o.reminders_sent]) continue;
    // Never two reminders in the same run for one order, even if it fell behind (only the latest is sent).
    const behind = DUE_AFTER_MIN.filter((m) => age >= m).length - 1;
    const order = behind > o.reminders_sent ? { ...o, reminders_sent: behind } : o;
    if (behind > o.reminders_sent) await db.from("orders").update({ reminders_sent: behind }).eq("id", o.id).eq("reminders_sent", o.reminders_sent);
    if (await remind(order)) sent++;
  }
  return sent;
}

// The first reminder, sent right away when the buyer cancels or the payment fails.
export async function remindNow(reference: string) {
  if (!/^ET[A-Z0-9]{8,40}$/.test(reference)) return;
  const { data: o } = await createAdminClient().from("orders").select("id, reference, email, created_at, reminders_sent, status").eq("reference", reference).maybeSingle();
  if (!o || o.status === "success" || o.reminders_sent > 0) return;
  await remind(o);
}
