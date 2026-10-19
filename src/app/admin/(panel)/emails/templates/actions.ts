"use server";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { SUPABASE_TAGS, fillTags, sampleVars, templateDef } from "@/lib/email/registry";
import { sendEmail } from "@/lib/email/send";
import { fillStored } from "@/lib/email/stored";
import { authEmail, type AuthEmail } from "@/lib/email/templates";
import type { Json } from "@/lib/database.types";

type Result = { ok?: string; error?: string };
const MAX_HTML = 400_000;

// Sign-in emails are sent by Supabase, so their design also has to be copied into Supabase's settings. That needs a
// Supabase access token on the server (SUPABASE_ACCESS_TOKEN); without one the design is saved here only.
async function pushToSupabase(key: AuthEmail, subject: string, html: string): Promise<string | null> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return "Saved, but not live yet: sign-in emails also need SUPABASE_ACCESS_TOKEN set on the server to reach Supabase.";
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ [`mailer_subjects_${key}`]: subject, [`mailer_templates_${key}_content`]: html }),
  });
  return res.ok ? null : "Saved here, but Supabase rejected the update. Check SUPABASE_ACCESS_TOKEN.";
}

export async function saveTemplate(key: string, input: { subject: string; design: Json; html: string }): Promise<Result> {
  const { admin, db } = await requireAdmin("emails");
  const def = templateDef(key);
  if (!def) return { error: "Unknown email." };
  const subject = input.subject.trim().slice(0, 200);
  if (!subject) return { error: "Add a subject line." };
  if (!input.html || input.html.length > MAX_HTML) return { error: "That design is too large to save." };
  const { error } = await db.from("email_templates").upsert({ key, subject, design: input.design, html: input.html, updated_at: new Date().toISOString(), updated_by: admin.id });
  if (error) return { error: "Could not save the design." };
  await audit(admin.id, "email_template.save", { type: "email_template", id: key });
  refresh();
  if (def.group === "auth") {
    const warning = await pushToSupabase(key as AuthEmail, fillTags(subject, SUPABASE_TAGS, "text"), fillTags(input.html, SUPABASE_TAGS, "html"));
    if (warning) return { error: warning };
    return { ok: "Saved. Supabase now sends this design." };
  }
  return { ok: "Saved. New emails use this design." };
}

export async function resetTemplate(key: string): Promise<Result> {
  const { admin, db } = await requireAdmin("emails");
  const def = templateDef(key);
  if (!def) return { error: "Unknown email." };
  await db.from("email_templates").delete().eq("key", key);
  await audit(admin.id, "email_template.reset", { type: "email_template", id: key });
  refresh();
  if (def.group === "auth") {
    const built = authEmail(key as AuthEmail, { url: "{{ .ConfirmationURL }}", email: "{{ .Email }}", newEmail: "{{ .NewEmail }}" });
    const warning = await pushToSupabase(key as AuthEmail, built.subject, built.html);
    if (warning) return { error: warning.replace("Saved", "Reset") };
  }
  return { ok: "Back to the built-in design." };
}

// Sends the design as it is in the editor (saved or not), filled with sample details, to the signed-in admin.
export async function sendTemplateTest(key: string, input: { subject: string; html: string }): Promise<Result> {
  const { admin } = await requireAdmin("emails");
  const def = templateDef(key);
  if (!def) return { error: "Unknown email." };
  const email = fillStored({ subject: `[Test] ${input.subject || def.subject}`, html: input.html }, sampleVars(def));
  const res = await sendEmail({ to: admin.email, userId: admin.id, kind: "test", ref: key, ...email });
  return res.ok ? { ok: `Test sent to ${admin.email}.` } : { error: res.error ?? "Couldn't send the test." };
}
