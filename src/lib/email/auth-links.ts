import type { AuthEmail } from "./templates";

// Where each Supabase sign-in email's button points. Supabase fills the {{ }} tags when it sends. The links go to
// /auth/confirm with a one-time token, so they work in any browser or device, not only the one that asked.
const FLOW: Record<AuthEmail, { type: string; next: string }> = {
  confirmation: { type: "email", next: "/learn" },
  recovery: { type: "recovery", next: "/reset-password" },
  email_change: { type: "email_change", next: "/settings/account" },
  magic_link: { type: "magiclink", next: "/learn" },
  invite: { type: "invite", next: "/reset-password" },
};

export function authLink(kind: AuthEmail) {
  const { type, next } = FLOW[kind];
  return `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${encodeURIComponent(next)}`;
}
