import { assetUrl, siteUrl } from "./site";

// One branded layout for every email, modelled on Tutor LMS: logo bar, illustrated banner, heading, greeting, body,
// an info box, one button, a sign-off, and the footer inside the card. Table-based with inline styles so it holds up
// in Gmail, Outlook and phones. Banners are PNGs in public/email (email apps block SVG).

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Block = { p: string } | { quote: string } | { list: string[] };

export type EmailContent = {
  // Inbox preview line.
  preheader: string;
  // File name in public/email, without .png.
  banner: string;
  heading: string;
  // First name for "Hi Ada,". Left out for emails to an address we don't have a name for.
  greeting?: string;
  // Plain strings; they are escaped here.
  blocks: Block[];
  // Highlighted details box, e.g. the course or certificate.
  info?: { title: string; rows: [string, string][] };
  cta?: { label: string; url: string };
  // Why they got it, shown small at the bottom. Notification emails link to their settings.
  reason: string;
  manageLink?: boolean;
};

const BLUE = "#2563eb";
const INK = "#1f2430";
const BODY = "#4a5160";
const MUTED = "#7a8294";
const LINE = "#e6e9f0";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function blockHtml(b: Block) {
  if ("p" in b) return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${BODY}">${esc(b.p)}</p>`;
  if ("quote" in b)
    return `<div style="margin:4px 0 20px;padding:16px 18px;background:#f6f8fc;border:1px solid ${LINE};border-left:4px solid ${BLUE};border-radius:8px;font-size:15px;line-height:1.65;color:${INK};white-space:pre-line">${esc(b.quote)}</div>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px">${b.list
    .map(
      (i) =>
        `<tr><td valign="top" style="padding:0 12px 10px 0"><span style="display:inline-block;width:22px;height:22px;border-radius:11px;background:#e8eeff;color:${BLUE};font-size:13px;font-weight:700;line-height:22px;text-align:center">&#10003;</span></td><td style="padding:0 0 10px;font-size:15px;line-height:1.6;color:${BODY}">${esc(i)}</td></tr>`,
    )
    .join("")}</table>`;
}

function infoHtml(info: NonNullable<EmailContent["info"]>) {
  const rows = info.rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;font-size:13.5px;color:${MUTED};width:42%">${esc(k)}</td><td style="padding:6px 0;font-size:13.5px;color:${INK};font-weight:600">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 24px;background:#f6f8fc;border:1px solid ${LINE};border-radius:10px">
<tr><td style="padding:18px 20px">
<p style="margin:0 0 ${rows ? "8px" : "0"};font-size:16px;font-weight:700;line-height:1.4;color:${INK}">${esc(info.title)}</p>
${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : ""}
</td></tr></table>`;
}

const blockText = (b: Block) => ("p" in b ? b.p : "quote" in b ? b.quote.split("\n").map((l) => `> ${l}`).join("\n") : b.list.map((i) => `- ${i}`).join("\n"));

export function render(c: EmailContent) {
  const site = siteUrl();
  const manage = c.manageLink ? ` <a href="${site}/settings/notifications" style="color:${MUTED};text-decoration:underline">Manage email preferences</a>` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.heading)}</title></head>
<body style="margin:0;padding:0;background:#f1f3f8;font-family:${FONT}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f8;padding:36px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden">
<tr><td style="padding:22px 32px;border-bottom:1px solid ${LINE}"><a href="${site}"><img src="${assetUrl()}/etivio-logo.png" width="116" height="31" alt="Etivio" style="display:block;border:0"></a></td></tr>
<tr><td style="padding:0;line-height:0"><img src="${assetUrl()}/email/${c.banner}.png" width="600" alt="" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:34px 40px 8px">
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:700;color:${INK}">${esc(c.heading)}</h1>
${c.greeting ? `<p style="margin:0 0 14px;font-size:16px;font-weight:600;color:${INK}">Hi ${esc(c.greeting)},</p>` : ""}
${c.blocks.map(blockHtml).join("\n")}
${c.info ? infoHtml(c.info) : ""}
${
  c.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 26px"><tr><td style="border-radius:8px;background:${BLUE}"><a href="${esc(c.cta.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${esc(c.cta.label)}</a></td></tr></table>`
    : ""
}
<p style="margin:0 0 30px;font-size:15px;line-height:1.6;color:${BODY}">Regards,<br><b style="color:${INK}">The Etivio team</b></p>
</td></tr>
<tr><td style="padding:20px 40px 24px;border-top:1px solid ${LINE};background:#fafbfd;font-size:12.5px;line-height:1.6;color:${MUTED}">${esc(c.reason)}${manage ? `<br>${manage}` : ""}</td></tr>
</table>
<p style="margin:18px 0 0;font-size:12px;color:${MUTED}">Etivio Africa &middot; <a href="${site}" style="color:${MUTED}">etivio.co</a></p>
</td></tr></table>
</body></html>`;
  const info = c.info ? [c.info.title, ...c.info.rows.map(([k, v]) => `${k}: ${v}`)].join("\n") : "";
  const text = [
    c.heading,
    "",
    c.greeting ? `Hi ${c.greeting},` : "",
    ...c.blocks.map(blockText).flatMap((t) => [t, ""]),
    info,
    "",
    c.cta ? `${c.cta.label}: ${c.cta.url}` : "",
    "",
    "Regards,\nThe Etivio team",
    "",
    "--",
    c.reason,
    c.manageLink ? `Manage email preferences: ${site}/settings/notifications` : "",
    "Etivio Africa · etivio.co",
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { html, text };
}
