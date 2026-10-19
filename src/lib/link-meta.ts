import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type LinkMeta = { title: string; description: string; image: string; siteName: string; partial: boolean };

const KNOWN: Record<string, string> = {
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "bloomberg.com": "Bloomberg",
  "businessday.ng": "BusinessDay",
  "cnbc.com": "CNBC",
  "forbes.com": "Forbes",
  "ft.com": "Financial Times",
  "nytimes.com": "New York Times",
  "punchng.com": "Punch",
  "reuters.com": "Reuters",
  "techcabal.com": "TechCabal",
  "techcrunch.com": "TechCrunch",
  "theguardian.com": "The Guardian",
};

export function siteName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (KNOWN[host]) return KNOWN[host];
    const part = host.split(".")[0];
    return part.charAt(0).toUpperCase() + part.slice(1);
  } catch {
    return "Source";
  }
}

// Blocks loopback, private, link-local and other internal ranges so the fetch can't reach our own network.
function isPrivate(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivate(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function safeUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
  if (url.username || url.password) throw new Error("credentials");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error("private");
  return url;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .trim();

function meta(html: string, ...names: string[]) {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) return decode(m[1]);
    }
  }
  return "";
}

// Reads the page's Open Graph tags. Follows up to 3 redirects, checking each hop, and reads at most 600 KB.
// Never throws: sites that block bots return `partial: true` so the admin can fill the fields by hand.
export async function fetchLinkMeta(raw: string): Promise<LinkMeta & { error?: string }> {
  const empty = { title: "", description: "", image: "", siteName: siteName(raw), partial: true };
  let url: URL;
  try {
    url = await safeUrl(raw.trim());
  } catch {
    return { ...empty, error: "That link can't be used. Paste a public https:// web address." };
  }
  try {
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; EtivioBot/1.0; +https://etivio.co)", accept: "text/html" },
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!next) break;
      url = await safeUrl(new URL(next, url).toString());
    }
    if (!res?.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("html")) return empty;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < 600_000) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    reader.cancel().catch(() => {});
    const html = new TextDecoder().decode(Buffer.concat(chunks));

    const title = meta(html, "og:title", "twitter:title") || decode(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "");
    const description = meta(html, "og:description", "twitter:description", "description");
    let image = meta(html, "og:image", "twitter:image", "og:image:url");
    if (image && !/^https?:\/\//.test(image)) image = new URL(image, url).toString();
    if (image && !/^https:\/\//.test(image)) image = "";
    const site = meta(html, "og:site_name") || siteName(url.toString());
    return { title: title.slice(0, 300), description: description.slice(0, 600), image, siteName: site.slice(0, 80), partial: !title };
  } catch {
    return empty;
  }
}
