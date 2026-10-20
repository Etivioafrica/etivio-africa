"use server";
import { headers } from "next/headers";
import { esc } from "@/lib/email/layout";
import { sendEmail, sentRecently } from "@/lib/email/send";
import { getPlatformSettings } from "@/lib/platform";
import type { FormState } from "@/app/(app)/teach/actions";
import { CONTACT_TOPICS as TOPICS } from "@/lib/help";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Contact form: emails the message to the support inbox with the visitor as the reply-to address.
export async function sendContactMessage(_prev: FormState, fd: FormData): Promise<FormState> {
  // Bots fill the hidden field; pretend it worked.
  if (String(fd.get("website") ?? "")) return { ok: "Thanks, your message is on its way." };

  const name = String(fd.get("name") ?? "").trim().slice(0, 100);
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const topic = TOPICS.find((t) => t === fd.get("topic")) ?? TOPICS[0];
  const reference = String(fd.get("reference") ?? "").trim().slice(0, 80);
  const message = String(fd.get("message") ?? "").trim().slice(0, 5000);
  if (name.length < 2) return { error: "Please tell us your name." };
  if (!EMAIL.test(email)) return { error: "Please enter a valid email address so we can reply." };
  if (message.length < 10) return { error: "Please add a little more detail to your message." };
  if (await sentRecently("contact", email, 2)) return { error: "We've just received a message from you. Please wait a couple of minutes before sending another." };

  const to = (await getPlatformSettings()).supportEmail || process.env.CONTACT_INBOX || "etivio.co@gmail.com";
  const page = (await headers()).get("referer") ?? "";
  const rows: [string, string][] = [
    ["Name", name],
    ["Email", email],
    ["Topic", topic],
    ...(reference ? ([["Payment reference", reference]] as [string, string][]) : []),
  ];
  const res = await sendEmail({
    to,
    replyTo: email,
    kind: "contact",
    ref: email,
    subject: `[Contact] ${topic}: ${name}`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#0a0f1a">
<h2 style="margin:0 0 12px">New message from the contact form</h2>
<table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#5f6b80">${k}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table>
<p style="white-space:pre-wrap;margin-top:16px;padding:16px;border:1px solid #e2e7f0;border-radius:10px">${esc(message)}</p>
<p style="color:#5f6b80;font-size:13px">Reply to this email to answer ${esc(name)} directly.${page ? ` Sent from ${esc(page)}.` : ""}</p></div>`,
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${message}`,
  });
  if (!res.ok) return { error: "Your message couldn't be sent right now. Please email us directly instead." };
  return { ok: "Thanks, your message is on its way. We usually reply within one working day." };
}
