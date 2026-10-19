import type { SupabaseClient } from "@supabase/supabase-js";

// The signed-in user from the session cookie, verified locally against the project's ES256 signing key (JWKS is
// fetched once and cached), so page loads don't wait on a round trip to Supabase Auth. Writes that need the
// freshest state (password, email, role changes) still use auth.getUser().
export async function sessionUser(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  const meta = (c.app_metadata ?? {}) as { provider?: string; providers?: string[] };
  return { id: c.sub, email: c.email ?? "", providers: meta.providers ?? (meta.provider ? [meta.provider] : []) };
}
