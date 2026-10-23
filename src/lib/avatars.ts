// Default avatars: ten character faces (public/avatars, from the Zaane Technologies Figma "Avatar explorations").
// Anyone without a photo gets one picked from their display name, so it looks random across people but is the same
// face for the same person on every page.
const COUNT = 10;

// The faces people can pick in Settings. Stored as these site paths in profiles.avatar_url.
export const AVATAR_FACES = Array.from({ length: COUNT }, (_, i) => `/avatars/${String(i + 1).padStart(2, "0")}.svg`);
export const isAvatarFace = (url: string | null | undefined) => !!url && AVATAR_FACES.includes(url);

export function defaultAvatar(seed: string) {
  // FNV-1a hash: cheap, and spreads similar names across different faces.
  let h = 0x811c9dc5;
  for (const ch of seed.trim().toLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193);
  }
  // Final mix so the low bits (which pick the face) depend on every character, not just the last few.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return `/avatars/${String(((h >>> 0) % COUNT) + 1).padStart(2, "0")}.svg`;
}
