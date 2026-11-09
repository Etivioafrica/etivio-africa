"use server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { notifyStaffChange } from "@/lib/email/staff";
import { audit, requireAdmin } from "@/lib/admin";
import { isOwnerEmail, isOwnerId, OWNER_ONLY } from "@/lib/owner";
import { ROLE_LABELS, STAFF_ROLES, type AppRole } from "@/lib/roles";
import type { FormState } from "@/app/(app)/teach/actions";
import { render } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/email/site";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function addStaff(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("team");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role") as AppRole;
  if (!STAFF_ROLES.includes(role)) return { error: "Pick a staff role." };
  if (role === "super_admin" && !isOwnerEmail(admin.email)) return { error: `${OWNER_ONLY} Ask the owner to add super admins.` };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  const name = str(fd, "name").slice(0, 80);
  const label = ROLE_LABELS[role];
  const { data: matches } = await db.rpc("admin_list_users", { p_search: email, p_limit: 5 });
  const found = (matches ?? []).find((u) => u.email.toLowerCase() === email);

  // No account yet: create one through a Supabase invite and email them a link to set their password.
  let userId = found?.id ?? null;
  let invited = false;
  if (!userId) {
    const { data, error } = await db.auth.admin.generateLink({ type: "invite", email, options: { data: { full_name: name || undefined } } });
    const token = data?.properties?.hashed_token;
    if (error || !data?.user || !token) return { error: "Could not create an account for that email. Try again in a minute." };
    userId = data.user.id;
    invited = true;
    const link = `${siteUrl()}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=invite&next=${encodeURIComponent("/reset-password")}`;
    const sent = await staffEmail(email, name, label, admin.name, link, true);
    if (!sent.ok) {
      await audit(admin.id, "team.invite_email_failed", { type: "user", id: userId }, { role, error: sent.error ?? "" });
    }
  }

  const { error } = await db.from("user_roles").upsert({ user_id: userId, role, granted_by: admin.id }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (error) return { error: "Could not add them to the team." };
  await audit(admin.id, invited ? "team.invite" : "team.add", { type: "user", id: userId }, { role });
  // Existing account: email + in-app notice via the shared notifier. New invite: they already got the set-password
  // email, so only the in-app notice and the owner's copy go out.
  after(() => notifyStaffChange({ targetId: userId!, added: [role], removed: [], actor: admin, skipTargetEmail: invited }));
  refresh();
  const who = found?.full_name || name || email;
  const as = label.toLowerCase() === "accounts" ? "on accounts" : `a ${label.toLowerCase()}`;
  return { ok: invited ? `Invite sent to ${email}. They become ${as} as soon as they set a password.` : `${who} is now ${as}. We emailed them a sign-in link.` };
}

export async function removeStaffRole(fd: FormData) {
  const { admin, db } = await requireAdmin("team");
  const id = str(fd, "id");
  const role = str(fd, "role") as AppRole;
  if (!STAFF_ROLES.includes(role)) return;
  // The owner's roles can't be touched by anyone else, and only the owner removes super admins.
  if (!isOwnerEmail(admin.email) && (role === "super_admin" || (await isOwnerId(id)))) return;
  // Never remove the last super admin, and never your own super admin role.
  if (role === "super_admin") {
    if (id === admin.id) return;
    const { count } = await db.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count ?? 0) <= 1) return;
  }
  await db.from("user_roles").delete().eq("user_id", id).eq("role", role);
  await audit(admin.id, "team.remove", { type: "user", id }, { role });
  after(() => notifyStaffChange({ targetId: id, added: [], removed: [role], actor: admin }));
  refresh();
}

// "You've been added to the Etivio team" (existing account) or "Set up your Etivio admin account" (new invite).
async function staffEmail(to: string, name: string, role: string, by: string, url: string, invite: boolean) {
  const first = name.trim().split(/\s+/)[0] || undefined;
  const { html, text } = render({
    preheader: invite ? `${by} invited you to help run Etivio.` : `${by} added you to the Etivio team.`,
    banner: "invite",
    heading: invite ? "Set up your Etivio admin account" : "You've been added to the Etivio team",
    greeting: first,
    blocks: [
      { p: `${by || "The Etivio team"} has given you the ${role} role on Etivio.` },
      invite
        ? { p: "Press the button below to set your password. Then sign in to the admin dashboard at etivio.co/admin/login with this email address. The link works once and expires in 24 hours." }
        : { p: "Sign in to the admin dashboard with your usual Etivio email and password." },
      { p: "Please turn on two-step sign-in in your settings once you're in, to keep Etivio safe." },
    ],
    cta: { label: invite ? "Set your password" : "Open the admin dashboard", url },
    reason: "You're getting this because an Etivio super admin added you to the team.",
  });
  return sendEmail({ to, subject: invite ? "You're invited to help run Etivio" : "You've been added to the Etivio team", html, text, kind: invite ? "staff_invite" : "staff_added" });
}

// Type-ahead search for the "Add a team member" box: existing accounts by name or email.
export async function searchUsersForTeam(q: string): Promise<{ id: string; name: string; email: string; avatar: string | null }[]> {
  const { db } = await requireAdmin("team");
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  const { data } = await db.rpc("admin_list_users", { p_search: term, p_limit: 8 });
  return (data ?? []).map((u) => ({ id: u.id, name: u.full_name || "", email: u.email, avatar: u.avatar_url || null }));
}
