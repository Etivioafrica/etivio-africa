"use server";
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { emailTest } from "@/lib/email/notify";
import type { FormState } from "@/app/(app)/teach/actions";

export async function sendTestEmail(): Promise<FormState> {
  const { admin } = await requireAdmin("emails");
  const res = await emailTest(admin.email, admin.id);
  refresh();
  return res.ok ? { ok: `Test email sent to ${admin.email}. Check your inbox (and spam).` } : { error: res.error ?? "Couldn't send the test email." };
}
