import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Role = Database["public"]["Enums"]["user_role"];

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  role: Role;
};

// One session + profile read per request, shared by the layout and pages.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, bio, role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name ?? "",
    avatarUrl: profile?.avatar_url ?? null,
    bio: profile?.bio ?? null,
    role: profile?.role ?? "student",
  };
});

export const canTeach = (role: Role) => role === "instructor" || role === "admin";
