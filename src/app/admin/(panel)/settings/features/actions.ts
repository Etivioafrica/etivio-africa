"use server";
import { refresh } from "next/cache";
import { audit, requireAdmin } from "@/lib/admin";
import { FEATURES, type FeatureKey, type FeatureStatus } from "@/lib/features";

export async function setFeature(key: string, status: string): Promise<{ ok?: string; error?: string }> {
  const { admin, db } = await requireAdmin("platform");
  if (!(key in FEATURES)) return { error: "Unknown feature." };
  if (!["off", "staff", "on"].includes(status)) return { error: "Unknown setting." };
  const { error } = await db.from("feature_flags").upsert({ key, status, updated_by: admin.id, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn't save. Try again." };
  await audit(admin.id, "feature.set", { type: "feature", id: key }, { status });
  refresh();
  const label = FEATURES[key as FeatureKey].label;
  const word: Record<FeatureStatus, string> = { off: "is off", staff: "is on for admins only", on: "is live for everyone" };
  return { ok: `${label} ${word[status as FeatureStatus]}.` };
}
