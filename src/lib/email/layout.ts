import { siteUrl } from "./send";

// One branded layout for every email. Table-based with inline styles so it holds up in Gmail, Outlook and phones.

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Block = { p: string } | { quote: string } | { list: string[] } | { code: string };

export type EmailContent = {
  // Inbox preview line.
  preheader: string;
  heading: string;
  // Plain strings; they are escaped here.
  blocks: Block[];
  cta?: { label: string; url: string };
  // Why they got it, shown small at the bottom. Notification emails link to their settings.
  reason: string;
  manageLink?: boolean;
};

const BLUE = "#2563eb";
const INK = "#0a0f1a";
const MUTED = "#5f6b80";
const LINE = "#e2e7f0";

function blockHtml(b: Block) {
  if ("p" in b) return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${INK}">${esc(b.p)}</p>`;
  if ("quote" in b)
    return `<div style="margin:0 0 18px;padding:14px 16px;border-left:3px solid ${BLUE};background:#f5f7fb;border-radius:8px;font-size:14.5px;line-height:1.6;color:${INK};white-space:pre-line">${esc(b.quote)}</div>`;
  if ("code" in b)
    return `<p style="margin:0 0 18px;font-size:13px;color:${MUTED}">Certificate ID: <b style="font-family:Menlo,Consolas,monospace;font-size:14px;color:${INK};letter-spacing:.06em">${esc(b.code)}</b></p>`;
  return `<ul style="margin:0 0 18px;padding-left:20px;font-size:15px;line-height:1.7;color:${INK}">${b.list.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function blockText(b: Block) {
  if ("p" in b) return b.p;
  if ("quote" in b) return b.quote.split("\n").map((l) => `> ${l}`).join("\n");
  if ("code" in b) return `Certificate ID: ${b.code}`;
  return b.list.map((i) => `- ${i}`).join("\n");
}

export function render(c: EmailContent) {
  const site = siteUrl();
  const manage = c.manageLink ? ` <a href="${site}/settings/notifications" style="color:${MUTED}">Manage email preferences</a>.` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.heading)}</title></head>
<body style="margin:0;padding:0;background:#f2f5fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5fa;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px"><a href="${site}" style="text-decoration:none;font-size:24px;font-weight:700;letter-spacing:-.02em;color:${BLUE}">etivio</a></td></tr>
<tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;padding:32px 30px">
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${INK}">${esc(c.heading)}</h1>
${c.blocks.map(blockHtml).join("\n")}
${
  c.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr><td style="border-radius:10px;background:${BLUE}"><a href="${esc(c.cta.url)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${esc(c.cta.label)}</a></td></tr></table>`
    : ""
}
</td></tr>
<tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.6;color:${MUTED}">${esc(c.reason)}${manage}<br>Etivio Africa · <a href="${site}" style="color:${MUTED}">etivio.co</a></td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = [c.heading, "", ...c.blocks.map(blockText).flatMap((t) => [t, ""]), c.cta ? `${c.cta.label}: ${c.cta.url}` : "", "", "--", c.reason, c.manageLink ? `Manage email preferences: ${site}/settings/notifications` : "", "Etivio Africa · etivio.co"]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { html, text };
}
