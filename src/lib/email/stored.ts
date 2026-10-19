import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMMON, fillTags } from "./registry";
import type { Rendered } from "./templates";

// Designs saved from the drag-and-drop editor. When an email has one, it's used with the person's details filled
// in; otherwise the built-in design is the fallback.

export type Stored = { subject: string; html: string } | null;

export async function storedTemplate(key: string): Promise<Stored> {
  const { data } = await createAdminClient().from("email_templates").select("subject, html").eq("key", key).maybeSingle();
  return data ?? null;
}

// Plain-text version for inboxes that don't show HTML.
export function htmlToText(html: string) {
  return html
    .replace(/<(head|style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `${label.replace(/<[^>]+>/g, "").trim()} (${href})`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function fillStored(stored: NonNullable<Stored>, vars: Record<string, string>): Rendered {
  const all = { ...Object.fromEntries(COMMON.map((p) => [p.tag, p.sample])), ...vars };
  const html = fillTags(stored.html, all, "html");
  return { subject: fillTags(stored.subject, all, "text"), html, text: htmlToText(html) };
}

// The saved design filled with `vars`, or the built-in email.
export async function compose(key: string, vars: Record<string, string>, fallback: () => Rendered): Promise<Rendered> {
  const stored = await storedTemplate(key);
  return stored ? fillStored(stored, vars) : fallback();
}
