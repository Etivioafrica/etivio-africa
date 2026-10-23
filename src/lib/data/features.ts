import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { isStaff, type AppRole } from "@/lib/roles";
import { FEATURES, FEATURE_KEYS, type FeatureKey, type FeatureMap, type FeatureStatus } from "@/lib/features";

// Current status of every feature (one read per request).
export const featureStatuses = cache(async (): Promise<Record<FeatureKey, FeatureStatus>> => {
  const { data } = await createAdminClient().from("feature_flags").select("key, status");
  const saved = new Map((data ?? []).map((r) => [r.key, r.status as FeatureStatus]));
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, saved.get(k) ?? FEATURES[k].initial])) as Record<FeatureKey, FeatureStatus>;
});

const allowed = (status: FeatureStatus, roles: AppRole[]) => status === "on" || (status === "staff" && isStaff(roles));

// Which features this set of roles can use.
export async function featuresFor(roles: AppRole[]): Promise<FeatureMap> {
  const s = await featureStatuses();
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, allowed(s[k], roles)])) as FeatureMap;
}

// For signed-in pages and actions.
export async function featureOn(key: FeatureKey) {
  const [s, user] = await Promise.all([featureStatuses(), getCurrentUser()]);
  return allowed(s[key], user.roles);
}

// For pages anyone can open (signed out counts as a learner).
export async function featureOnForVisitor(key: FeatureKey) {
  const s = await featureStatuses();
  if (s[key] === "on") return true;
  if (s[key] === "off") return false;
  const viewer = await sessionUser(await createClient());
  if (!viewer) return false;
  const { data } = await createAdminClient().from("user_roles").select("role").eq("user_id", viewer.id);
  return isStaff((data ?? []).map((r) => r.role));
}
