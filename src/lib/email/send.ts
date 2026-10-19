import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Sends through Resend's HTTP API. Without RESEND_API_KEY (local dev) emails are logged as skipped, never thrown,
// so a mail problem can't break the action that triggered it.

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: string;
  userId?: string | null;
  ref?: string | null;
  // Bulk mail (announcements) gets a List-Unsubscribe header pointing at notification settings.
  bulk?: boolean;
};

const API = "https://api.resend.com";
export const emailConfigured = () => !!process.env.RESEND_API_KEY;
export const emailFrom = () => process.env.EMAIL_FROM || "Etivio <hello@etivio.co>";
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://etivio.co").replace(/\/$/, "");

function payload(m: Mail) {
  return {
    from: emailFrom(),
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
    ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
    ...(m.bulk ? { headers: { "List-Unsubscribe": `<${siteUrl()}/settings/notifications>` } } : {}),
  };
}

type LogRow = { m: Mail; status: "sent" | "failed" | "skipped"; id?: string | null; error?: string | null };

async function log(rows: LogRow[]) {
  if (!rows.length) return;
  await createAdminClient()
    .from("email_log")
    .insert(
      rows.map(({ m, status, id, error }) => ({
        user_id: m.userId ?? null,
        to_email: m.to,
        kind: m.kind,
        subject: m.subject.slice(0, 300),
        status,
        provider_id: id ?? null,
        error: error?.slice(0, 500) ?? null,
        ref: m.ref ?? null,
      })),
    )
    .then(
      () => {},
      () => {},
    );
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; data?: { id: string }[]; message?: string };
  return { ok: res.ok, json };
}

export async function sendEmail(m: Mail): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) {
    await log([{ m, status: "skipped", error: "RESEND_API_KEY is not set" }]);
    return { ok: false, error: "Email isn't set up yet (RESEND_API_KEY is missing)." };
  }
  try {
    const { ok, json } = await post("/emails", payload(m));
    await log([{ m, status: ok ? "sent" : "failed", id: json.id, error: ok ? null : json.message || "Send failed" }]);
    return ok ? { ok } : { ok, error: json.message || "Send failed" };
  } catch (e) {
    await log([{ m, status: "failed", error: e instanceof Error ? e.message : "Network error" }]);
    return { ok: false, error: "Couldn't reach the email service." };
  }
}

// Up to 100 per request with Resend's batch endpoint.
export async function sendBatch(mails: Mail[]) {
  if (!mails.length) return;
  if (!emailConfigured()) return log(mails.map((m) => ({ m, status: "skipped" as const, error: "RESEND_API_KEY is not set" })));
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100);
    try {
      const { ok, json } = await post("/emails/batch", chunk.map(payload));
      await log(chunk.map((m, j) => ({ m, status: ok ? ("sent" as const) : ("failed" as const), id: json.data?.[j]?.id, error: ok ? null : json.message || "Send failed" })));
    } catch (e) {
      await log(chunk.map((m) => ({ m, status: "failed" as const, error: e instanceof Error ? e.message : "Network error" })));
    }
  }
}

// True when an email of this kind about `ref` went out within the last `minutes`.
export async function sentRecently(kind: string, ref: string, minutes: number) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count } = await createAdminClient().from("email_log").select("id", { count: "exact", head: true }).eq("kind", kind).eq("ref", ref).eq("status", "sent").gte("created_at", since);
  return (count ?? 0) > 0;
}
