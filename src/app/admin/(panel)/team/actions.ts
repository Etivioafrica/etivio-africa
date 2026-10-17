"use server";
import { refresh } from "next/cache";
import { audit, requireSuperAdmin } from "@/lib/admin";
import type { FormState } from "@/app/(app)/teach/actions";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function addAdmin(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireSuperAdmin();
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role") === "super_admin" ? "super_admin" : "admin";
  const { data: matches } = await db.rpc("admin_list_users", { p_search: email, p_limit: 5 });
  const user = (matches ?? []).find((u) => u.email.toLowerCase() === email);
  if (!user) return { error: "No Etivio account uses that email. They need to sign up first." };
  if (user.id === admin.id) return { error: "That's you." };
  await db.from("profiles").update({ role, status: "active" }).eq("id", user.id);
  await audit(admin.id, "team.add", { type: "user", id: user.id }, { role });
  refresh();
  return { ok: `${user.full_name || email} is now ${role === "super_admin" ? "a super admin" : "an admin"}.` };
}

export async function removeAdmin(fd: FormData) {
  const { admin, db } = await requireSuperAdmin();
  const id = str(fd, "id");
  if (id === admin.id) return;
  // Keep instructors teaching: demote to instructor if they own courses.
  const { count } = await db.from("courses").select("id", { count: "exact", head: true }).eq("instructor_id", id);
  await db.from("profiles").update({ role: count ? "instructor" : "student" }).eq("id", id);
  await audit(admin.id, "team.remove", { type: "user", id });
  refresh();
}
