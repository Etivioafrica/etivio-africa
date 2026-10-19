import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformSettings = {
  supportEmail: string | null;
  supportWhatsapp: string | null;
  socials: { label: string; href: string }[];
  tutorApplicationsOpen: boolean;
  certificateSigner: { name: string; title: string };
  announcement: { text: string; link: string | null } | null;
  heroBgUrl: string | null;
};

const SOCIALS = [
  ["social_x", "X"],
  ["social_instagram", "Instagram"],
  ["social_linkedin", "LinkedIn"],
  ["social_youtube", "YouTube"],
  ["social_tiktok", "TikTok"],
] as const;

// Public-safe platform settings for any page (including signed-out ones). Read with the service role because
// platform_settings is only readable by signed-in users; nothing private (like commission) is returned.
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  const { data: s } = await createAdminClient().from("platform_settings").select("*").maybeSingle();
  return {
    supportEmail: s?.support_email ?? null,
    supportWhatsapp: s?.support_whatsapp ?? null,
    socials: SOCIALS.flatMap(([key, label]) => (s?.[key] ? [{ label, href: s[key]! }] : [])),
    tutorApplicationsOpen: s?.tutor_applications_open ?? true,
    certificateSigner: { name: s?.certificate_signer_name || "The Etivio team", title: s?.certificate_signer_title || "Etivio Africa" },
    announcement: s?.announcement_active && s.announcement_text ? { text: s.announcement_text, link: s.announcement_link } : null,
    heroBgUrl: s?.hero_bg_url ?? null,
  };
});

// wa.me link for a phone number like "+234 801 234 5678".
export const whatsappLink = (n: string) => `https://wa.me/${n.replace(/\D/g, "")}`;
