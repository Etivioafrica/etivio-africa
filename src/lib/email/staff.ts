import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { render } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/email/site";
import { isOwnerEmail } from "@/lib/owner";
import { ROLE_LABELS, STAFF_ROLES, type AppRole } from "@/lib/roles";

// Staff role changes from any admin page: the person gets an email and an in-app notification, and the owner gets
// an email whenever someone else changes a staff role. Creator roles (tutor, coach) keep their own emails.
export async function notifyStaffChange(opts: {
  targetId: string;
  added: string[];
  removed: string[];
  actor: { id: string; name: string; email: string };
  skipTargetEmail?: boolean;
}) {
  const added = opts.added.filter((r) => STAFF_ROLES.includes(r as AppRole)) as AppRole[];
  const removed = opts.removed.filter((r) => STAFF_ROLES.includes(r as AppRole)) as AppRole[];
  if (!added.length && !removed.length) return;

  const db = createAdminClient();
  const [{ data: who }, { data: profile }] = await Promise.all([db.auth.admin.getUserById(opts.targetId), db.from("profiles").select("full_name").eq("id", opts.targetId).maybeSingle()]);
  const email = who?.user?.email;
  const name = profile?.full_name || email || "Team member";
  const first = (profile?.full_name ?? "").trim().split(/\s+/)[0] || undefined;
  const by = opts.actor.name || "An Etivio admin";
  const labels = (rs: AppRole[]) => rs.map((r) => ROLE_LABELS[r]).join(", ");
  const site = siteUrl();

  // In-app notification for the person.
  const title = added.length ? `You're now ${labels(added)} on Etivio` : `Your ${labels(removed)} role was removed`;
  const body = added.length ? `${by} gave you admin access. Sign in at etivio.co/admin/login.` : `${by} changed your Etivio admin access.`;
  await db.from("notifications").insert({ user_id: opts.targetId, kind: "staff_role", title, body, href: added.length ? "/admin" : null });

  // Email to the person.
  if (email && !opts.skipTargetEmail) {
    const { html, text } = render({
      preheader: body,
      banner: "invite",
      heading: added.length ? "You've been added to the Etivio team" : "Your Etivio admin access changed",
      greeting: first,
      blocks: [
        ...(added.length ? [{ p: `${by} has given you the ${labels(added)} role on Etivio.` }] : []),
        ...(removed.length ? [{ p: `Your ${labels(removed)} role has been removed${added.length ? "" : ` by ${by}`}.` }] : []),
        ...(added.length
          ? [{ p: "Sign in to the admin dashboard with your usual Etivio email and password." }, { p: "Please turn on two-step sign-in in your settings once you're in, to keep Etivio safe." }]
          : [{ p: "If you think this is a mistake, reply to this email or contact the Etivio team." }]),
      ],
      cta: added.length ? { label: "Open the admin dashboard", url: `${site}/admin/login` } : undefined,
      reason: "You're getting this because your role on the Etivio team changed.",
    });
    await sendEmail({ to: email, subject: added.length ? "You've been added to the Etivio team" : "Your Etivio admin access changed", html, text, kind: "staff_role", userId: opts.targetId });
  }

  // Security copy to the owner(s) when someone else made the change.
  if (isOwnerEmail(opts.actor.email)) return;
  const ownerEmails = (process.env.ETIVIO_OWNER_EMAILS || "etivio.co@gmail.com").split(",").map((e) => e.trim()).filter(Boolean);
  const { html, text } = render({
    preheader: `${by} changed admin roles for ${name}.`,
    banner: "invite",
    heading: "An admin role changed on Etivio",
    blocks: [{ p: `${by} (${opts.actor.email}) changed the admin roles for ${name}${email ? ` (${email})` : ""}.` }],
    info: { title: "What changed", rows: [...(added.length ? ([["Added", labels(added)]] as [string, string][]) : []), ...(removed.length ? ([["Removed", labels(removed)]] as [string, string][]) : [])] },
    cta: { label: "Review the team", url: `${site}/admin/team` },
    reason: "You're getting this because you own this Etivio account. Owners are told about every admin role change.",
  });
  for (const to of ownerEmails) await sendEmail({ to, subject: `Admin role changed: ${name}`, html, text, kind: "staff_role_owner", ref: opts.targetId });
}
