import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireFullSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import { canAccess, isStaff, type AdminArea, type AppRole } from "@/lib/roles";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  roles: AppRole[];
  isSuper: boolean;
};

// Current staff member (super admin, editor, accountant), or null for anyone else.
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  await requireFullSession(supabase, "/admin");
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url, status, deleted_at").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const roles = (roleRows ?? []).map((r) => r.role);
  if (!profile || profile.status !== "active" || profile.deleted_at || !isStaff(roles)) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    name: profile.full_name ?? "",
    avatarUrl: profile.avatar_url,
    roles,
    isSuper: roles.includes("super_admin"),
  };
});

// Staff gate for an admin area. Staff without access to the area land on the dashboard.
export async function requireAdmin(area: AdminArea = "dashboard") {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");
  if (!canAccess(admin.roles, area)) redirect("/admin?denied=1");
  return { admin, db: createAdminClient() };
}

export const requireSuperAdmin = () => requireAdmin("users");

// Record an admin action. Failures never block the action itself.
export async function audit(actorId: string, action: string, target?: { type: string; id: string }, meta: Json = {}) {
  await createAdminClient()
    .from("admin_audit_log")
    .insert({ actor_id: actorId, action, target_type: target?.type ?? null, target_id: target?.id ?? null, meta });
}
