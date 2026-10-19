import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/roles";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  roles: AppRole[];
  // Sign-in methods on the account, e.g. ["email", "google"].
  providers: string[];
  // Latest tutor application, so the Teach area can appear once someone has applied.
  tutorApplication: "pending" | "approved" | "rejected" | null;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Server-side backstop for the proxy: a session that still owes its two-step code goes to /verify.
export async function requireFullSession(supabase: Supabase, next: string) {
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect(`/verify?next=${encodeURIComponent(next)}`);
}

// One session + profile read per request, shared by the layout and pages.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireFullSession(supabase, "/learn");

  const [{ data: profile }, { data: roles }, { data: application }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url, bio, status, deleted_at").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase
      .from("role_applications")
      .select("status")
      .eq("user_id", user.id)
      .eq("role", "tutor")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (profile?.status === "suspended" || profile?.deleted_at) redirect("/suspended");

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name ?? "",
    avatarUrl: profile?.avatar_url ?? null,
    bio: profile?.bio ?? null,
    roles: roles?.length ? roles.map((r) => r.role) : ["student"],
    providers: (user.app_metadata?.providers as string[] | undefined) ?? (user.app_metadata?.provider ? [user.app_metadata.provider] : []),
    tutorApplication: application?.status ?? null,
  };
});
