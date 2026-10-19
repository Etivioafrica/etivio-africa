import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPrefs, type NotificationPrefs } from "@/lib/data/profile";

export type Recipient = { userId: string; email: string; name: string };

const firstName = (full: string | null) => (full ?? "").trim().split(/\s+/)[0] || "there";

// One user's address, or null if they're suspended, deleted, or opted out of `pref`.
export async function recipient(userId: string, pref?: keyof NotificationPrefs): Promise<Recipient | null> {
  const db = createAdminClient();
  const [{ data: auth }, { data: p }] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db.from("profiles").select("full_name, status, deleted_at, notification_prefs").eq("id", userId).maybeSingle(),
  ]);
  const email = auth.user?.email;
  if (!email || !p || p.status !== "active" || p.deleted_at) return null;
  if (pref && !readPrefs(p.notification_prefs)[pref]) return null;
  return { userId, email, name: firstName(p.full_name) };
}

// Everyone active who allows `pref`. Pages through auth users, so it scales past one request's worth.
export async function everyone(pref: keyof NotificationPrefs): Promise<Recipient[]> {
  const db = createAdminClient();
  const emails = new Map<string, string>();
  for (let page = 1; page < 100; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const u of users) if (u.email && u.email_confirmed_at) emails.set(u.id, u.email);
    if (users.length < 1000) break;
  }
  const out: Recipient[] = [];
  const ids = [...emails.keys()];
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await db.from("profiles").select("id, full_name, status, deleted_at, notification_prefs").in("id", ids.slice(i, i + 500));
    for (const p of data ?? []) {
      if (p.status !== "active" || p.deleted_at || !readPrefs(p.notification_prefs)[pref]) continue;
      out.push({ userId: p.id, email: emails.get(p.id)!, name: firstName(p.full_name) });
    }
  }
  return out;
}
