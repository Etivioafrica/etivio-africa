"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin";

export async function adminSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// Called right after a password sign-in on /admin/login. Non-admins are signed straight back out.
export async function confirmAdminAccess(): Promise<{ ok: boolean }> {
  const admin = await getAdminUser();
  if (admin) return { ok: true };
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: false };
}
