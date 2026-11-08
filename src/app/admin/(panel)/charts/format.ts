import type { Kind } from "@/lib/data/charts";
import { compactMoney } from "@/lib/format";

export const fmt = (v: number, kind: Kind) =>
  kind === "money" ? compactMoney(Math.round(v)) : kind === "percent" ? `${v.toFixed(1)}%` : Math.round(v).toLocaleString("en-NG");

// Exact figures for the table and CSV.
export const exact = (v: number, kind: Kind) =>
  kind === "money" ? `₦${(v / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}` : kind === "percent" ? `${v.toFixed(1)}%` : Math.round(v).toLocaleString("en-NG");
