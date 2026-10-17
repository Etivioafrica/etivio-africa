"use server";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { CREATOR_ROLES, LIVE_CREATOR_ROLES, ROLE_LABELS, type AppRole } from "@/lib/roles";
import type { FormState } from "@/app/(app)/teach/actions";

// Users apply for creator roles; a super admin approves them in the admin.
export async function applyForRole(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const role = String(fd.get("role") ?? "") as AppRole;
  if (!CREATOR_ROLES.includes(role) || !LIVE_CREATOR_ROLES.includes(role)) return { error: "This role isn't open for applications yet." };
  if (user.roles.includes(role)) return { error: `You're already a ${ROLE_LABELS[role].toLowerCase()}.` };
  const message = String(fd.get("message") ?? "").trim().slice(0, 2000);
  if (message.length < 20) return { error: "Tell us a little about what you want to teach (at least 20 characters)." };

  const supabase = await createClient();
  const { error } = await supabase.from("role_applications").insert({ user_id: user.id, role, message });
  if (error) return { error: error.code === "23505" ? "Your application is already being reviewed." : "Could not send your application." };
  refresh();
  return { ok: "Application sent. We'll let you know once it's reviewed." };
}
