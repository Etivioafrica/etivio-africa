"use server";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { deleteObject, keyFromUrl } from "@/lib/r2";
import type { FormState } from "@/app/(app)/teach/actions";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

// "x.com/etivio" or a full URL → https URL; "" stays empty; null when it isn't a valid link.
function link(raw: string): string | null {
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function savePlatformSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("platform");
  const commission = Number(str(fd, "commission_percent"));
  if (!Number.isFinite(commission) || commission < 0 || commission > 100) return { error: "Commission must be between 0 and 100." };
  const whatsapp = str(fd, "support_whatsapp");
  if (whatsapp && !/^\+?[0-9 ]{7,20}$/.test(whatsapp)) return { error: "WhatsApp number should look like +234 801 234 5678." };

  const socials: Record<string, string | null> = {};
  for (const key of ["social_x", "social_instagram", "social_linkedin", "social_youtube", "social_tiktok"]) {
    const url = link(str(fd, key));
    if (url === null) return { error: "One of the social links isn't a valid web address." };
    socials[key] = url || null;
  }

  const { error } = await db
    .from("platform_settings")
    .update({
      commission_percent: commission,
      support_email: str(fd, "support_email") || null,
      support_whatsapp: whatsapp || null,
      ...socials,
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { error: "Could not save settings." };
  await audit(admin.id, "settings.update", undefined, { commission_percent: commission });
  refresh();
  return { ok: "Platform settings saved. Commission changes apply to future sales only." };
}

export async function saveAdminProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("settings");
  const name = str(fd, "full_name");
  if (!name) return { error: "Add your name." };
  // The photo saves on its own from the crop modal (saveAvatar), so this only touches the name.
  const { error } = await db.from("profiles").update({ full_name: name }).eq("id", admin.id);
  if (error) return { error: "Could not save your profile." };
  refresh();
  return { ok: "Profile saved." };
}

// Dashboard welcome banner background. Empty (or "reset") goes back to the built-in default image.
export async function saveHeroBackground(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("platform");
  const url = fd.get("reset") === "1" ? "" : str(fd, "hero_bg_url");
  if (url && !/^https?:\/\//.test(url)) return { error: "Upload an image first." };

  const { data: before } = await db.from("platform_settings").select("hero_bg_url").single();
  const { error } = await db
    .from("platform_settings")
    .update({ hero_bg_url: url || null, updated_by: admin.id, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { error: "Could not save the banner." };
  // Remove the replaced image from R2 so old uploads don't pile up.
  if (before?.hero_bg_url && before.hero_bg_url !== url) await deleteObject(keyFromUrl(before.hero_bg_url));
  await audit(admin.id, "settings.hero_background", undefined, { hero_bg_url: url || null });
  refresh();
  return { ok: url ? "Banner background updated for all learners." : "Banner reset to the default background." };
}

// Used by the crop modal: saves (or with null, resets) the banner background directly.
export async function setHeroBackground(url: string | null): Promise<{ error?: string }> {
  const fd = new FormData();
  if (url) fd.set("hero_bg_url", url);
  else fd.set("reset", "1");
  const res = await saveHeroBackground(null, fd);
  return res?.error ? { error: res.error } : {};
}

export async function saveLearningSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("platform");
  const { error } = await db
    .from("platform_settings")
    .update({
      tutor_applications_open: fd.get("tutor_applications_open") === "on",
      certificate_signer_name: str(fd, "certificate_signer_name").slice(0, 80) || null,
      certificate_signer_title: str(fd, "certificate_signer_title").slice(0, 80) || null,
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { error: "Could not save learning settings." };
  await audit(admin.id, "settings.learning", undefined, { tutor_applications_open: fd.get("tutor_applications_open") === "on" });
  refresh();
  return { ok: "Learning settings saved." };
}

export async function saveAnnouncement(_prev: FormState, fd: FormData): Promise<FormState> {
  const { admin, db } = await requireAdmin("platform");
  const text = str(fd, "announcement_text").slice(0, 200);
  const active = fd.get("announcement_active") === "on";
  const href = str(fd, "announcement_link");
  const url = href.startsWith("/") ? href : link(href);
  if (url === null) return { error: "The link isn't a valid web address. Use a full link or a path like /learn/browse." };
  if (active && !text) return { error: "Write the announcement before turning it on." };

  const { error } = await db
    .from("platform_settings")
    .update({ announcement_text: text || null, announcement_link: url || null, announcement_active: active, updated_by: admin.id, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { error: "Could not save the announcement." };
  await audit(admin.id, "settings.announcement", undefined, { active, text });
  refresh();
  return { ok: active ? "Announcement is live on learners' dashboards." : "Announcement saved (hidden)." };
}
