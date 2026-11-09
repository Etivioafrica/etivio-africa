import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The Etivio owner account(s). Nobody else can change, suspend or delete them, and only an owner can make someone a
// super admin or take that role away. Set in code (override with ETIVIO_OWNER_EMAILS, comma separated) so it can't be
// changed from the admin dashboard.
const OWNER_EMAILS = (process.env.ETIVIO_OWNER_EMAILS || "etivio.co@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const isOwnerEmail = (email: string | null | undefined) => !!email && OWNER_EMAILS.includes(email.trim().toLowerCase());

export async function isOwnerId(userId: string) {
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  return isOwnerEmail(data?.user?.email);
}

export const OWNER_ONLY = "Only the Etivio owner can do this.";
export const OWNER_PROTECTED = "This is the Etivio owner's account. It can't be changed by other admins.";
