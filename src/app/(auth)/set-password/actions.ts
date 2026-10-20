"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// First sign-in for accounts made by a guest purchase: replaces the emailed temporary password.
export async function setFirstPassword(_prev: { error?: string } | null, fd: FormData): Promise<{ error?: string } | null> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const next = String(fd.get("next") ?? "/learn");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message.includes("different") ? "Choose a password different from the temporary one." : "Couldn't save your password. Please try again." };
  await createAdminClient().auth.admin.updateUserById(user.id, { app_metadata: { must_set_password: false } });
  // Fresh session so the cleared flag is in the cookie straight away.
  await supabase.auth.refreshSession();
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/learn");
}
