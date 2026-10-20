// YouTube/Vimeo page links play in an iframe; anything else plays as a video file.
export function videoEmbed(url: string): { kind: "iframe" | "video"; src: string } | null {
  if (!/^https?:\/\//.test(url)) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: "video", src: url };
}

export type VideoSource = { provider: "youtube"; id: string } | { provider: "vimeo"; id: string } | { provider: "file"; src: string };

// For the learner player, which drives YouTube itself instead of showing YouTube's own controls.
export function videoSource(url: string): VideoSource | null {
  if (!/^https?:\/\//.test(url)) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { provider: "youtube", id: yt[1] };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { provider: "vimeo", id: vimeo[1] };
  return { provider: "file", src: url };
}
