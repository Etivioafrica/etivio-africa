"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { after } from "next/server";
import { emailApplicationDecision } from "@/lib/email/notify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { audit, requireAdmin } from "@/lib/admin";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import type { Database } from "@/lib/database.types";
import type { FormState } from "@/app/(app)/teach/actions";

const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];
const PURGE_AFTER_DAYS = 30;
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// Loads the target. Nobody edits their own account from here.
async function guardTarget(targetId: string) {
  const ctx = await requireAdmin("users");
  if (targetId === ctx.admin.id) throw new Error("You can't change your own account here.");
  const { data: target } = await ctx.db.from("profiles").select("id, status, full_name, deleted_at").eq("id", targetId).single();
  if (!target) throw new Error("User not found.");
  return { ...ctx, target };
}

export async function setUserRoles(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const { admin, db, target } = await guardTarget(str(fd, "id"));
    // Everyone stays a student.
    const wanted = new Set<AppRole>(["student", ...(fd.getAll("roles").map(String).filter((r) => ALL_ROLES.includes(r as AppRole)) as AppRole[])]);
    const { data: current } = await db.from("user_roles").select("role").eq("user_id", target.id);
    const have = new Set((current ?? []).map((r) => r.role));
    const add = [...wanted].filter((r) => !have.has(r));
    const remove = [...have].filter((r) => !wanted.has(r));

    if (add.length) await db.from("user_roles").insert(add.map((role) => ({ user_id: target.id, role, granted_by: admin.id })));
    if (remove.length) await db.from("user_roles").delete().eq("user_id", target.id).in("role", remove);
    // Approving by hand also settles any open application for that role.
    if (add.length)
      await db
        .from("role_applications")
        .update({ status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
        .eq("user_id", target.id)
        .eq("status", "pending")
        .in("role", add);

    if (add.length || remove.length) await audit(admin.id, "user.roles", { type: "user", id: target.id }, { added: add, removed: remove });

    // Trusted tutors skip the course review queue.
    const trusted = fd.get("trusted") === "1";
    const { data: before } = await db.from("profiles").select("trusted_tutor").eq("id", target.id).maybeSingle();
    const trustChanged = !!before && before.trusted_tutor !== trusted;
    if (trustChanged) {
      await db.from("profiles").update({ trusted_tutor: trusted }).eq("id", target.id);
      await audit(admin.id, trusted ? "user.trust" : "user.untrust", { type: "user", id: target.id });
    }
    refresh();
    return { ok: add.length || remove.length || trustChanged ? "Roles updated." : "No changes." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// One role on or off, from the users list (after the admin approves it in a dialog). Leaves trusted_tutor alone.
export async function toggleUserRole(id: string, role: AppRole, on: boolean, note = ""): Promise<FormState> {
  try {
    const { admin, db, target } = await guardTarget(id);
    if (!ALL_ROLES.includes(role) || role === "student") return { error: "Everyone stays a student." };
    if (on) {
      const { error } = await db.from("user_roles").upsert({ user_id: target.id, role, granted_by: admin.id }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) return { error: error.message };
      await db
        .from("role_applications")
        .update({ status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
        .eq("user_id", target.id)
        .eq("status", "pending")
        .eq("role", role);
    } else {
      const { error } = await db.from("user_roles").delete().eq("user_id", target.id).eq("role", role);
      if (error) return { error: error.message };
    }
    await audit(admin.id, "user.roles", { type: "user", id: target.id }, {
      added: on ? [role] : [],
      removed: on ? [] : [role],
      ...(note.trim() ? { note: note.trim().slice(0, 500) } : {}),
    });
    refresh();
    return { ok: `${ROLE_LABELS[role]} role ${on ? "given to" : "removed from"} ${target.full_name || "user"}.` };
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
  const { admin, db } = await requireAdmin("users");
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
  const { admin, db } = await requireAdmin("users");
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
  const { admin, db } = await requireAdmin("users");
  const userId = str(fd, "id");
  const courseId = str(fd, "course_id");
  await db.from("enrollments").delete().eq("user_id", userId).eq("course_id", courseId);
  await audit(admin.id, "user.revoke_course", { type: "user", id: userId }, { course_id: courseId });
  refresh();
}

// Soft delete: hidden, signed out, and banned now; erased for good after PURGE_AFTER_DAYS.
export async function deleteUser(fd: FormData) {
  const { admin, db, target } = await guardTarget(str(fd, "id"));
  await db.from("profiles").update({ deleted_at: new Date().toISOString(), deleted_by: admin.id }).eq("id", target.id);
  await db.auth.admin.updateUserById(target.id, { ban_duration: "876000h" });
  await audit(admin.id, "user.delete", { type: "user", id: target.id }, { name: target.full_name ?? "" });
  redirect("/admin/users?deleted=1");
}

export async function restoreUser(fd: FormData) {
  const { admin, db, target } = await guardTarget(str(fd, "id"));
  await db.from("profiles").update({ deleted_at: null, deleted_by: null }).eq("id", target.id);
  if (target.status === "active") await db.auth.admin.updateUserById(target.id, { ban_duration: "none" });
  await audit(admin.id, "user.restore", { type: "user", id: target.id });
  refresh();
}

// Permanent erase. Payments keep their amounts; the buyer link becomes empty.
async function purge(db: SupabaseClient<Database>, id: string) {
  const { count } = await db.from("courses").select("id", { count: "exact", head: true }).eq("instructor_id", id);
  if (count) return false;
  const { error } = await db.auth.admin.deleteUser(id);
  return !error;
}

export async function purgeUser(fd: FormData) {
  const { admin, db, target } = await guardTarget(str(fd, "id"));
  if (!target.deleted_at) return;
  if (!(await purge(db, target.id))) throw new Error("This tutor still owns courses. Reassign them to someone else first.");
  await audit(admin.id, "user.purge", { type: "user", id: target.id }, { name: target.full_name ?? "" });
  redirect("/admin/users?deleted=1");
}

// Called when the users list loads, so expired deletions don't need a scheduler.
export async function purgeExpiredUsers(db: SupabaseClient<Database>) {
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 86_400_000).toISOString();
  const { data } = await db.from("profiles").select("id").not("deleted_at", "is", null).lt("deleted_at", cutoff).limit(20);
  for (const p of data ?? []) await purge(db, p.id);
}

export async function reviewApplication(fd: FormData) {
  const { admin, db } = await requireAdmin("users");
  const id = str(fd, "id");
  const approve = str(fd, "decision") === "approve";
  const { data: app } = await db.from("role_applications").select("user_id, role, status").eq("id", id).single();
  if (!app || app.status !== "pending") return;
  await db
    .from("role_applications")
    .update({ status: approve ? "approved" : "rejected", reviewed_by: admin.id, reviewed_at: new Date().toISOString(), review_note: str(fd, "note") || null })
    .eq("id", id);
  if (approve) await db.from("user_roles").upsert({ user_id: app.user_id, role: app.role, granted_by: admin.id }, { onConflict: "user_id,role", ignoreDuplicates: true });
  await audit(admin.id, `application.${approve ? "approve" : "reject"}`, { type: "user", id: app.user_id }, { role: app.role });
  const note = str(fd, "note") || null;
  after(() => emailApplicationDecision(app.user_id, app.role, approve, note));
  refresh();
}
