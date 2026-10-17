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
};

// One session + profile read per request, shared by the layout and pages.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url, bio, status, deleted_at").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (profile?.status === "suspended" || profile?.deleted_at) redirect("/suspended");

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name ?? "",
    avatarUrl: profile?.avatar_url ?? null,
    bio: profile?.bio ?? null,
    roles: roles?.length ? roles.map((r) => r.role) : ["student"],
  };
});
