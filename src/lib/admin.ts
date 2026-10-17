import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import type { Role } from "@/lib/auth";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  isSuper: boolean;
};

export const isAdminRole = (role: Role) => role === "admin" || role === "super_admin";

// Current admin, or null for anyone else (signed out, non-admin, suspended).
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role, status")
    .eq("id", user.id)
    .single();
  if (!profile || profile.status !== "active" || !isAdminRole(profile.role)) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    name: profile.full_name ?? "",
    avatarUrl: profile.avatar_url,
    role: profile.role,
    isSuper: profile.role === "super_admin",
  };
});

export async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");
  return { admin, db: createAdminClient() };
}

export async function requireSuperAdmin() {
  const ctx = await requireAdmin();
  if (!ctx.admin.isSuper) redirect("/admin?denied=1");
  return ctx;
}

// Record an admin action. Failures never block the action itself.
export async function audit(actorId: string, action: string, target?: { type: string; id: string }, meta: Json = {}) {
  await createAdminClient()
    .from("admin_audit_log")
    .insert({ actor_id: actorId, action, target_type: target?.type ?? null, target_id: target?.id ?? null, meta });
}
