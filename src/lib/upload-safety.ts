// Upload safety, shared by /api/upload/sign, /api/upload/finish and the file pickers. A file is identified by its first bytes ("magic
// numbers"), never by its name or the type the browser claims, so a script renamed to .pdf is still caught.

export type Family = "image" | "video" | "audio" | "pdf" | "office" | "zip" | "epub" | "text" | "font" | "psd";

// What each upload kind accepts.
export const KIND_FAMILIES = {
  cover: ["image"],
  avatar: ["image"],
  post: ["image"],
  banner: ["image"],
  blog: ["image"],
  video: ["video"],
  document: ["pdf", "office", "zip", "text", "image", "audio"],
  product: ["pdf", "office", "zip", "epub", "text", "image", "audio", "video", "font", "psd"],
} satisfies Record<string, Family[]>;

const EXTENSIONS: Record<Family, string[]> = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "avif"],
  video: ["mp4", "m4v", "mov", "webm", "mkv"],
  audio: ["mp3", "m4a", "wav", "ogg", "oga", "flac"],
  pdf: ["pdf"],
  office: ["docx", "xlsx", "pptx"],
  zip: ["zip"],
  epub: ["epub"],
  text: ["txt", "csv", "md", "srt", "vtt", "json"],
  font: ["ttf", "otf", "woff", "woff2"],
  psd: ["psd"],
};

// Never accepted, whatever is inside: programs, scripts, web pages, SVG (can carry scripts), macro Office files,
// disk images, and the old Office formats (can't be checked for macros; save as .docx/.xlsx/.pptx instead).
const BLOCKED = new Set(
  "exe dll com bat cmd msi msp scr cpl pif lnk reg hta wsf vbs vbe js mjs cjs jse ps1 psm1 sh bash zsh csh command jar apk aab ipa dmg pkg app deb rpm iso img vhd html htm xhtml shtml svg svgz xml xsl php phtml asp aspx jsp py rb pl cgi docm dotm xlsm xltm xlam pptm potm ppsm ppam sldm doc dot xls xlt ppt pps rar 7z".split(" "),
);

export const extOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

// The `accept` attribute for a kind's file picker.
export const acceptFor = (kind: keyof typeof KIND_FAMILIES) =>
  (KIND_FAMILIES[kind] as Family[]).flatMap((f) => EXTENSIONS[f].map((e) => `.${e}`)).join(",");

const at = (b: Uint8Array, offset: number, ...bytes: number[]) => bytes.every((x, i) => b[offset + i] === x);
const ascii = (b: Uint8Array, offset: number, s: string) => at(b, offset, ...[...s].map((c) => c.charCodeAt(0)));

// Content that is dangerous whatever the file is called.
function dangerous(b: Uint8Array) {
  if (at(b, 0, 0x4d, 0x5a)) return "a Windows program"; // MZ
  if (at(b, 0, 0x7f, 0x45, 0x4c, 0x46)) return "a Linux program"; // ELF
  if (at(b, 0, 0xcf, 0xfa, 0xed, 0xfe) || at(b, 0, 0xce, 0xfa, 0xed, 0xfe) || at(b, 0, 0xfe, 0xed, 0xfa, 0xce) || at(b, 0, 0xca, 0xfe, 0xba, 0xbe)) return "a Mac program";
  if (ascii(b, 0, "#!")) return "a script";
  if (at(b, 0, 0xd0, 0xcf, 0x11, 0xe0)) return "an old-format Office file (save it as .docx, .xlsx or .pptx)";
  if (ascii(b, 0, "Rar!") || at(b, 0, 0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return "a RAR or 7z archive (use .zip)";
  const head = new TextDecoder("utf-8", { fatal: false }).decode(b.subarray(0, 512)).replace(/^﻿/, "").trimStart().toLowerCase();
  if (/^<(!doctype|html|head|body|script|svg|\?xml|iframe|object)/.test(head)) return "a web page or SVG";
  return null;
}

type Sniffed = { family: Family; type: string };

// Identify the file from its first bytes. Zip-based formats are told apart by extension once the zip itself is
// confirmed. Returns null for anything unrecognised.
function identify(b: Uint8Array, ext: string): Sniffed | null {
  if (at(b, 0, 0xff, 0xd8, 0xff)) return { family: "image", type: "image/jpeg" };
  if (at(b, 0, 0x89, 0x50, 0x4e, 0x47)) return { family: "image", type: "image/png" };
  if (ascii(b, 0, "GIF8")) return { family: "image", type: "image/gif" };
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return { family: "image", type: "image/webp" };
  if (ascii(b, 4, "ftyp")) {
    const brand = String.fromCharCode(...b.subarray(8, 12));
    if (brand === "avif" || brand === "avis") return { family: "image", type: "image/avif" };
    if (brand.startsWith("M4A")) return { family: "audio", type: "audio/mp4" };
    if (brand === "qt  ") return { family: "video", type: "video/quicktime" };
    return { family: "video", type: "video/mp4" };
  }
  if (at(b, 0, 0x1a, 0x45, 0xdf, 0xa3)) return { family: "video", type: ext === "mkv" ? "video/x-matroska" : "video/webm" };
  if (ascii(b, 0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { family: "audio", type: "audio/mpeg" };
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE")) return { family: "audio", type: "audio/wav" };
  if (ascii(b, 0, "OggS")) return { family: "audio", type: "audio/ogg" };
  if (ascii(b, 0, "fLaC")) return { family: "audio", type: "audio/flac" };
  if (ascii(b, 0, "%PDF-")) return { family: "pdf", type: "application/pdf" };
  if (ascii(b, 0, "8BPS")) return { family: "psd", type: "image/vnd.adobe.photoshop" };
  if (at(b, 0, 0x00, 0x01, 0x00, 0x00) || ascii(b, 0, "OTTO") || ascii(b, 0, "true")) return { family: "font", type: ext === "otf" ? "font/otf" : "font/ttf" };
  if (ascii(b, 0, "wOFF")) return { family: "font", type: "font/woff" };
  if (ascii(b, 0, "wOF2")) return { family: "font", type: "font/woff2" };
  if (at(b, 0, 0x50, 0x4b, 0x03, 0x04)) {
    if (ext === "docx") return { family: "office", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    if (ext === "xlsx") return { family: "office", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    if (ext === "pptx") return { family: "office", type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
    if (ext === "epub") return { family: "epub", type: "application/epub+zip" };
    return { family: "zip", type: "application/zip" };
  }
  // Plain text: no NUL bytes and valid UTF-8 in the first chunk.
  if (EXTENSIONS.text.includes(ext) && !b.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(b);
      return { family: "text", type: ext === "csv" ? "text/csv" : ext === "json" ? "application/json" : "text/plain" };
    } catch {}
  }
  return null;
}

const DESCRIBE: Record<Family, string> = {
  image: "an image",
  video: "a video",
  audio: "an audio file",
  pdf: "a PDF",
  office: "an Office file",
  zip: "a zip file",
  epub: "an e-book",
  text: "a text file",
  font: "a font",
  psd: "a Photoshop file",
};

// Quick check on the name alone, before any bytes are sent (the content is still checked once the file arrives).
export function checkName(kind: keyof typeof KIND_FAMILIES, fileName: string): string | null {
  const ext = extOf(fileName);
  if (BLOCKED.has(ext)) return `.${ext} files can't be uploaded to Etivio.`;
  const allowed = (KIND_FAMILIES[kind] as Family[]).flatMap((f) => EXTENSIONS[f]);
  if (ext && !allowed.includes(ext)) return `That type of file isn't accepted here. Allowed: ${allowed.join(", ")}.`;
  return null;
}

export type Verdict ={ ok: true; family: Family; type: string; ext: string } | { ok: false; error: string };

// The whole check for one upload: name, then content, then whether this kind accepts it.
export function checkUpload(kind: keyof typeof KIND_FAMILIES, fileName: string, head: Uint8Array): Verdict {
  const ext = extOf(fileName);
  if (BLOCKED.has(ext)) return { ok: false, error: `.${ext} files can't be uploaded to Etivio.` };
  const bad = dangerous(head);
  if (bad) return { ok: false, error: `This file looks like ${bad}, so it can't be uploaded.` };
  const found = identify(head, ext);
  const families = KIND_FAMILIES[kind] as Family[];
  if (!found || !families.includes(found.family)) {
    const allowed = families.flatMap((f) => EXTENSIONS[f]).join(", ");
    return { ok: false, error: found ? `That type of file isn't accepted here. Allowed: ${allowed}.` : `We couldn't recognise this file. Allowed: ${allowed}.` };
  }
  // The extension has to match what's inside (no PDF named .jpg); fix it up to the real one if it's missing.
  const realExts = EXTENSIONS[found.family];
  if (ext && !realExts.includes(ext)) return { ok: false, error: `This file is named .${ext} but it's really ${DESCRIBE[found.family]}. Rename it and try again.` };
  return { ok: true, family: found.family, type: found.type, ext: ext || realExts[0] };
}
