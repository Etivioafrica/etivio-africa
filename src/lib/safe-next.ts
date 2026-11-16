// Where to send someone after sign-in, from a `next` value in a link. Only paths on this site are allowed:
// it must start with a single "/", and may not contain a backslash or control character, which browsers and
// `new URL()` read as "//" and would turn "/\evil.com" into another site.
export function safeNext(next: string | null | undefined, fallback: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
