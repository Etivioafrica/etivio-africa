"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { audit, isAdminRole, requireAdmin, requireSuperAdmin } from "@/lib/admin";
import type { Role } from "@/lib/auth";
import type { FormState } from "@/app/(app)/teach/actions";

const ROLES: Role[] = ["student", "instructor", "admin", "super_admin"];
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// Loads the target and enforces: never yourself, and only super admins touch other admins.
async function guardTarget(targetId: string) {
  const ctx = await requireAdmin();
  if (targetId === ctx.admin.id) throw new Error("You can't change your own account here.");
  const { data: target } = await ctx.db.from("profiles").select("id, role, status, full_name").eq("id", targetId).single();
  if (!target) throw new Error("User not found.");
  if (isAdminRole(target.role) && !ctx.admin.isSuper) throw new Error("Only super admins can change admin accounts.");
  return { ...ctx, target };
}

export async function setUserRole(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const role = str(fd, "role") as Role;
    if (!ROLES.includes(role)) return { error: "Pick a valid role." };
    const { admin, db, target } = await guardTarget(str(fd, "id"));
    if (isAdminRole(role) && !admin.isSuper) return { error: "Only super admins can grant admin access." };
    const { error } = await db.from("profiles").update({ role }).eq("id", target.id);
    if (error) return { error: "Could not change the role." };
    await audit(admin.id, "user.role", { type: "user", id: target.id }, { from: target.role, to: role });
    refresh();
    return { ok: `Role changed to ${role.replace("_", " ")}.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function setUserStatus(fd: FormData) {
  const { admin, db, target } = await guardTarget(str(fd, "id"));
  const status = str(fd, "status") === "suspended" ? "suspended" : "active";
  await db.from("profiles").update({ status }).eq("id", target.id);
  // A ban also stops existing sessions from refreshing.
  await db.auth.admin.updateUserById(target.id, { ban_duration: status === "suspended" ? "876000h" : "none" });
  await audit(admin.id, `user.${status === "suspended" ? "suspend" : "reactivate"}`, { type: "user", id: target.id });
  refresh();
}

export async function sendPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin();
  const id = str(fd, "id");
  const { data } = await db.auth.admin.getUserById(id);
  const email = data.user?.email;
  if (!email) return { error: "This user has no email address." };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${site}/auth/callback?next=/settings` });
  if (error) return { error: error.message.includes("rate") ? "Email limit reached. Try again later." : "Could not send the reset email." };
  await audit(admin.id, "user.password_reset", { type: "user", id });
  return { ok: `Reset link sent to ${email}.` };
}

export async function grantCourseAccess(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin();
  const userId = str(fd, "id");
  const courseId = str(fd, "course_id");
  if (!courseId) return { error: "Pick a course." };
  const { error } = await db.from("enrollments").insert({ user_id: userId, course_id: courseId });
  if (error) return { error: error.code === "23505" ? "Already enrolled in that course." : "Could not enroll the user." };
  await audit(admin.id, "user.grant_course", { type: "user", id: userId }, { course_id: courseId });
  refresh();
  return { ok: "Course access granted." };
}

export async function revokeCourseAccess(fd: FormData) {
  const { admin, db } = await requireAdmin();
  const userId = str(fd, "id");
  const courseId = str(fd, "course_id");
  await db.from("enrollments").delete().eq("user_id", userId).eq("course_id", courseId);
  await audit(admin.id, "user.revoke_course", { type: "user", id: userId }, { course_id: courseId });
  refresh();
}

export async function deleteUser(fd: FormData) {
  const { admin, db } = await requireSuperAdmin();
  const id = str(fd, "id");
  if (id === admin.id) return;
  const { count } = await db.from("courses").select("id", { count: "exact", head: true }).eq("instructor_id", id);
  if (count) throw new Error("Reassign or delete this instructor's courses first.");
  await db.auth.admin.deleteUser(id);
  await audit(admin.id, "user.delete", { type: "user", id });
  redirect("/admin/users");
}
