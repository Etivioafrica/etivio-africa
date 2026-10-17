"use server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "../teach/actions";

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const avatar = String(fd.get("avatar_url") ?? "").trim();
  if (avatar && !/^https?:\/\//.test(avatar)) return { error: "Avatar must be a full http(s) URL." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: String(fd.get("full_name") ?? "").trim() || null,
      bio: String(fd.get("bio") ?? "").trim() || null,
      avatar_url: avatar || null,
    })
    .eq("id", user.id);
  if (error) return { error: "Could not save your profile." };
  refresh();
  return { ok: "Profile saved." };
}
