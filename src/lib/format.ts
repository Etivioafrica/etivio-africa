// Display helpers shared by the dashboards.

export function formatPrice(minor: number, currency = "NGN") {
  if (minor === 0) return "Free";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}

export function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export function percent(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
