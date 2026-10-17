"use server";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { ROLE_LABELS, STAFF_ROLES, type AppRole } from "@/lib/roles";
import type { FormState } from "@/app/(app)/teach/actions";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function addStaff(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("team");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role") as AppRole;
  if (!STAFF_ROLES.includes(role)) return { error: "Pick a staff role." };
  const { data: matches } = await db.rpc("admin_list_users", { p_search: email, p_limit: 5 });
  const user = (matches ?? []).find((u) => u.email.toLowerCase() === email);
  if (!user) return { error: "No Etivio account uses that email. They need to sign up first." };
  const { error } = await db.from("user_roles").upsert({ user_id: user.id, role, granted_by: admin.id }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (error) return { error: "Could not add them to the team." };
  await audit(admin.id, "team.add", { type: "user", id: user.id }, { role });
  refresh();
  return { ok: `${user.full_name || email} is now ${ROLE_LABELS[role].toLowerCase() === "accounts" ? "on accounts" : `a ${ROLE_LABELS[role].toLowerCase()}`}.` };
}

export async function removeStaffRole(fd: FormData) {
  const { admin, db } = await requireAdmin("team");
  const id = str(fd, "id");
  const role = str(fd, "role") as AppRole;
  if (!STAFF_ROLES.includes(role)) return;
  // Never remove the last super admin, and never your own super admin role.
  if (role === "super_admin") {
    if (id === admin.id) return;
    const { count } = await db.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count ?? 0) <= 1) return;
  }
  await db.from("user_roles").delete().eq("user_id", id).eq("role", role);
  await audit(admin.id, "team.remove", { type: "user", id }, { role });
  refresh();
}
