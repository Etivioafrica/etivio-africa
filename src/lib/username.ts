// Usernames power public profiles at etivio.co/@username.

export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

// Words that would collide with app routes or could be used to impersonate Etivio.
const RESERVED = new Set([
  "admin", "administrator", "api", "app", "auth", "blog", "billing", "courses", "dashboard", "docs", "etivio",
  "help", "learn", "login", "logout", "me", "official", "privacy", "profile", "root", "settings", "signin", "signup", "staff",
  "support", "system", "teach", "team", "terms", "tutor", "verify", "www",
]);

export function normalizeUsername(raw: string) {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

// Returns an error message, or null when the username is acceptable.
export function usernameProblem(name: string): string | null {
  if (!USERNAME_RE.test(name)) return "Usernames are 3 to 30 characters: lowercase letters, numbers, and underscores.";
  if (RESERVED.has(name)) return "That username is reserved. Try another.";
  return null;
}

export const profilePath = (username: string) => `/@${username}`;

// Candidate usernames from free-form seeds (typed text, full name, email handle), most natural first.
export function usernameCandidates(seeds: string[]) {
  const clean = (v: string) => v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const words = (v: string) => clean(v).split(/[^a-z0-9]+/).filter(Boolean);
  const out: string[] = [];
  const later: string[] = [];
  const add = (v: string) => {
    const c = v.replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
    if (c && !usernameProblem(c) && !out.includes(c)) out.push(c);
  };
  for (const seed of seeds) {
    const w = words(seed);
    if (!w.length) continue;
    add(w.join(""));
    add(w.join("_"));
    if (w.length > 1) {
      add(`${w[0]}${w[w.length - 1]}`);
      add(`${w[0]}_${w[w.length - 1]}`);
      add(`${w[0]}${w[w.length - 1][0]}`);
      add(`${w[w.length - 1]}${w[0]}`);
    }
    later.push(`${w[0]}_learns`);
  }
  later.forEach(add);
  // Numbered fallbacks off the first seed that produced anything.
  const base = out[0];
  if (base) for (const n of [1, 7, 12, 24, 99, 2026]) add(`${base.slice(0, 30 - String(n).length)}${n}`);
  return out.slice(0, 20);
}
