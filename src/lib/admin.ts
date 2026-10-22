import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireFullSession } from "@/lib/auth";
import { getMyPrivateProfile } from "@/lib/my-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionUser } from "@/lib/supabase/session";
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
  const user = await sessionUser(supabase);
  if (!user) return null;
  await requireFullSession(supabase, "/admin");
  const [{ data: profile }, priv, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single(),
    getMyPrivateProfile(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const roles = (roleRows ?? []).map((r) => r.role);
  if (!profile || priv?.status !== "active" || priv?.deleted_at || !isStaff(roles)) return null;
  return {
    id: user.id,
    email: user.email,
    name: profile.full_name ?? "",
    avatarUrl: profile.avatar_url,
    roles,
    isSuper: roles.includes("super_admin"),
  };
});

// Staff gate for an admin area. Staff without access to the area land on the dashboard.
// Pass several areas when any one of them is enough (product decisions: Marketplace or the review queue).
export async function requireAdmin(area: AdminArea | AdminArea[] = "dashboard") {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");
  if (![area].flat().some((a) => canAccess(admin.roles, a))) {
    // Reviewers have no dashboard; send them to their queue instead of back to a page they can't open.
    redirect(canAccess(admin.roles, "dashboard") ? "/admin?denied=1" : "/admin/review");
  }
  return { admin, db: createAdminClient() };
}

export const requireSuperAdmin = () => requireAdmin("users");

// Record an admin action. Failures never block the action itself.
export async function audit(actorId: string, action: string, target?: { type: string; id: string }, meta: Json = {}) {
  await createAdminClient()
    .from("admin_audit_log")
    .insert({ actor_id: actorId, action, target_type: target?.type ?? null, target_id: target?.id ?? null, meta });
}
