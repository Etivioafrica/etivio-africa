// Shared blog helpers for the admin and the public blog.

export type PostStatus = "draft" | "scheduled" | "published";

// What a reader sees: a scheduled post counts as published once its time has passed.
export function liveStatus(p: { status: PostStatus; published_at: string | null }, now = Date.now()): PostStatus {
  if (p.status === "draft") return "draft";
  if (p.published_at && Date.parse(p.published_at) > now) return "scheduled";
  return "published";
}

// Posts written before the rich editor were plain text: blank lines split paragraphs, "## " started a heading.
export function toHtml(content: string | null) {
  const text = content ?? "";
  if (!text.trim() || /^\s*</.test(text)) return text;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => (b.startsWith("## ") ? `<h2>${esc(b.slice(3))}</h2>` : `<p>${esc(b).replace(/\n/g, "<br>")}</p>`))
    .join("");
}

export function readMinutes(html: string | null) {
  const words = (html ?? "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export const plainText = (html: string | null) =>
  (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type SeoInput = { title: string; excerpt: string; content: string; cover: string; metaTitle: string; metaDesc: string; keyword: string };

// Same checklist as the Finance with Anne editor.
export function seoChecks({ title, excerpt, content, cover, metaTitle, metaDesc, keyword }: SeoInput) {
  const effTitle = metaTitle || title;
  const effDesc = metaDesc || excerpt;
  const text = plainText(content);
  const words = text.split(/\s+/).filter(Boolean).length;
  const kw = keyword.trim().toLowerCase();
  const has = (s: string) => (kw ? (s.toLowerCase().includes(kw) ? "Found" : "Missing") : "No keyword");
  const checks = [
    { label: "Meta title (50 to 60 characters)", ok: effTitle.length >= 50 && effTitle.length <= 60, value: `${effTitle.length} chars` },
    { label: "Meta description (120 to 160 characters)", ok: effDesc.length >= 120 && effDesc.length <= 160, value: `${effDesc.length} chars` },
    { label: "Focus keyword in title", ok: !!kw && title.toLowerCase().includes(kw), value: has(title) },
    { label: "Focus keyword in description", ok: !!kw && effDesc.toLowerCase().includes(kw), value: has(effDesc) },
    { label: "Focus keyword in content", ok: !!kw && text.toLowerCase().includes(kw), value: has(text) },
    { label: "Cover image set", ok: !!cover, value: cover ? "Yes" : "No" },
    { label: "Excerpt written", ok: !!excerpt, value: excerpt ? "Yes" : "Missing" },
    { label: "Word count (300 or more)", ok: words >= 300, value: `${words} words` },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { checks, score, effTitle, effDesc, tone: score >= 75 ? "good" : score >= 50 ? "ok" : "poor" } as const;
}

export const fmtLong = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
export const fmtShort = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export function fmtSeconds(secs: number | null) {
  if (!secs) return "None yet";
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
}
