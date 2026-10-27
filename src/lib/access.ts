// How long a learner keeps a course after enrolling (courses.access_days; null = lifetime). Shared by server and client.
export const ACCESS_PRESETS: { days: number | null; label: string }[] = [
  { days: null, label: "Lifetime" },
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
];

// "Lifetime", "6 months", "45 days".
export function accessPeriod(days: number | null | undefined) {
  if (!days) return "Lifetime";
  const preset = ACCESS_PRESETS.find((p) => p.days === days);
  if (preset) return preset.label;
  if (days % 365 === 0) return `${days / 365} years`;
  return `${days} ${days === 1 ? "day" : "days"}`;
}

// "Lifetime access" / "6 months of access".
export const accessLabel = (days: number | null | undefined) => (days ? `${accessPeriod(days)} of access` : "Lifetime access");

export const isExpired = (expiresAt: string | null | undefined) => !!expiresAt && new Date(expiresAt).getTime() <= Date.now();

// PostgREST filter for enrolments that still give access: .or(activeAccess())
export const activeAccess = () => `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;
