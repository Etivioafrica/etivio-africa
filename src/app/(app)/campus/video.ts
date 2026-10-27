// Video links in Campus posts: which sites play inline and how. Shared by the composer, the server check and the feed.
export type PostVideo =
  | { kind: "embed"; site: string; src: string; tall?: boolean }
  | { kind: "file"; site: string; src: string };

const FILE = /\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i;

export function parseVideo(raw: string | null | undefined): PostVideo | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  const path = url.pathname;
  let m: RegExpMatchArray | null;

  if (host === "youtu.be" && (m = path.match(/^\/([\w-]{11})/))) return { kind: "embed", site: "YouTube", src: `https://www.youtube-nocookie.com/embed/${m[1]}` };
  if (host === "youtube.com") {
    const id = url.searchParams.get("v") ?? path.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) return { kind: "embed", site: "YouTube", src: `https://www.youtube-nocookie.com/embed/${id}`, tall: path.startsWith("/shorts/") };
  }
  if ((host === "vimeo.com" || host === "player.vimeo.com") && (m = path.match(/\/(?:video\/)?(\d{6,12})/))) return { kind: "embed", site: "Vimeo", src: `https://player.vimeo.com/video/${m[1]}?dnt=1` };
  if (host === "loom.com" && (m = path.match(/^\/(?:share|embed)\/([a-f0-9]{32})/))) return { kind: "embed", site: "Loom", src: `https://www.loom.com/embed/${m[1]}` };
  if (host === "dailymotion.com" && (m = path.match(/^\/(?:embed\/)?video\/([a-z0-9]+)/i))) return { kind: "embed", site: "Dailymotion", src: `https://www.dailymotion.com/embed/video/${m[1]}` };
  if (host === "dai.ly" && (m = path.match(/^\/([a-z0-9]+)/i))) return { kind: "embed", site: "Dailymotion", src: `https://www.dailymotion.com/embed/video/${m[1]}` };
  if (host === "tiktok.com" && (m = path.match(/\/video\/(\d{8,25})/))) return { kind: "embed", site: "TikTok", src: `https://www.tiktok.com/embed/v2/${m[1]}`, tall: true };
  // A direct link to a video file (e.g. a Reddit or CDN .mp4) plays in a plain video player.
  if (FILE.test(path) || FILE.test(url.search)) return { kind: "file", site: host, src: url.toString() };
  return null;
}

// The first playable video link in some text.
export function videoIn(text: string) {
  for (const m of text.matchAll(/https:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g)) if (parseVideo(m[0])) return m[0];
  return null;
}

export const VIDEO_SITES = "YouTube, Vimeo, Loom, Dailymotion, TikTok or a video file link";
