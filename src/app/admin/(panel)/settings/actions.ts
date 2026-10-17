"use server";
import { refresh } from "next/cache";
import { audit, requireAdmin, requireSuperAdmin } from "@/lib/admin";
import { deleteObject, keyFromUrl } from "@/lib/r2";
import type { FormState } from "@/app/(app)/teach/actions";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function savePlatformSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireSuperAdmin();
  const commission = Number(str(fd, "commission_percent"));
  if (!Number.isFinite(commission) || commission < 0 || commission > 100) return { error: "Commission must be between 0 and 100." };
  const { error } = await db
    .from("platform_settings")
    .update({ commission_percent: commission, support_email: str(fd, "support_email") || null, updated_by: admin.id, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { error: "Could not save settings." };
  await audit(admin.id, "settings.update", undefined, { commission_percent: commission });
  refresh();
  return { ok: "Settings saved. New commission applies to future sales only." };
}

export async function saveAdminProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin();
  const name = str(fd, "full_name");
  if (!name) return { error: "Add your name." };
  const avatar = str(fd, "avatar_url") || null;
  const { error } = await db.from("profiles").update({ full_name: name, avatar_url: avatar }).eq("id", admin.id);
  if (error) return { error: "Could not save your profile." };
  if (admin.avatarUrl && admin.avatarUrl !== avatar) await deleteObject(keyFromUrl(admin.avatarUrl));
  refresh();
  return { ok: "Profile saved." };
}
