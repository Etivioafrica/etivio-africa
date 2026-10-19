import "server-only";
import { randomInt } from "node:crypto";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { getLearnerProfile } from "@/lib/data/profile";
import { emailCertificates } from "@/lib/email/notify";

// No 0/O or 1/I so codes are easy to read out and type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export type Certificate = {
  code: string;
  courseId: string | null;
  recipientName: string;
  courseTitle: string;
  instructorName: string | null;
  issuedAt: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
};

// Issues a certificate for every completed course that doesn't have one yet. Service role, so learners can't mint their own.
export async function syncCertificates(userId: string) {
  const data = await getLearnerProfile(userId);
  if (!data) return;
  const done = data.courses.filter((c) => c.completed);
  if (!done.length) return;

  const supabase = await createClient();
  const { data: have } = await supabase.from("certificates").select("course_id").eq("user_id", userId);
  const issued = new Set((have ?? []).map((c) => c.course_id));
  const fresh = done.filter((c) => !issued.has(c.id));
  if (!fresh.length) return;

  const { data: issuedNow } = await createAdminClient()
    .from("certificates")
    .upsert(
      fresh.map((c) => ({
        code: newCode(),
        user_id: userId,
        course_id: c.id,
        recipient_name: data.profile.name,
        course_title: c.title,
        instructor_name: c.instructor,
      })),
      { onConflict: "user_id,course_id", ignoreDuplicates: true },
    )
    .select("code, course_title");
  if (issuedNow?.length) after(() => emailCertificates(userId, issuedNow));
}

export async function getMyCertificates(userId: string): Promise<Certificate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("certificates")
    .select("code, course_id, recipient_name, course_title, instructor_name, issued_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("issued_at", { ascending: false });
  return (data ?? []).map((c) => ({
    code: c.code,
    courseId: c.course_id,
    recipientName: c.recipient_name,
    courseTitle: c.course_title,
    instructorName: c.instructor_name,
    issuedAt: c.issued_at,
  }));
}

// Public verification by code (anyone with the link). Service role, returns only what's printed on the certificate.
export const getCertificate = cache(async (code: string): Promise<(Certificate & { username: string | null }) | null> => {
  if (!/^[A-Z0-9]{8}$/.test(code)) return null;
  const { data: c } = await createAdminClient()
    .from("certificates")
    .select("code, course_id, recipient_name, course_title, instructor_name, issued_at, revoked_at, revoked_reason, owner:profiles!certificates_user_id_fkey(username, profile_public, deleted_at)")
    .eq("code", code)
    .maybeSingle();
  if (!c) return null;
  const owner = c.owner as { username: string | null; profile_public: boolean; deleted_at: string | null } | null;
  if (owner?.deleted_at) return null;
  return {
    code: c.code,
    courseId: c.course_id,
    recipientName: c.recipient_name,
    courseTitle: c.course_title,
    instructorName: c.instructor_name,
    issuedAt: c.issued_at,
    revokedAt: c.revoked_at,
    revokedReason: c.revoked_reason,
    username: owner?.profile_public ? owner.username : null,
  };
});

// "Add to profile" link for LinkedIn's certification form.
export function linkedInAddUrl(cert: Certificate, site: string) {
  const d = new Date(cert.issuedAt);
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: cert.courseTitle,
    organizationName: "Etivio",
    issueYear: String(d.getUTCFullYear()),
    issueMonth: String(d.getUTCMonth() + 1),
    certUrl: `${site}/certificate/${cert.code}`,
    certId: cert.code,
  });
  return `https://www.linkedin.com/profile/add?${q}`;
}
