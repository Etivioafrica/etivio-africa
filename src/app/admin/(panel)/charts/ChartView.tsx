"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChartColumn, ChartSpline, Download, Info } from "lucide-react";
import type { ChartResult, Grain } from "@/lib/data/charts";
import { exact, fmt } from "./format";

const W = 1000;
const H = 320;
const PAD = { l: 64, r: 16, t: 16, b: 36 };

function label(key: string, grain: Grain, long = false) {
  const d = new Date(`${grain === "month" ? `${key}-01` : key}T00:00:00Z`);
  if (grain === "month") return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  const s = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(long ? { year: "numeric" } : {}), timeZone: "UTC" });
  return grain === "week" ? `Week of ${s}` : s;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

export function ChartView({ title, desc, grain, days, data }: { title: string; desc: string; grain: Grain; days: number; data: ChartResult }) {
  const [type, setType] = useState<"line" | "bar">("line");
  const [hover, setHover] = useState<number | null>(null);
  const main = data.rows.find((r) => r.primary) ?? data.rows[0];
  const vals = main.values;
  const n = vals.length;
  const max = niceMax(Math.max(...vals, 0));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const barW = Math.max(2, (iw / Math.max(n, 1)) * 0.7);
  const bx = (i: number) => PAD.l + (iw / n) * (i + 0.5);

  const path = useMemo(() => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" "), [vals, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.max(1, Math.ceil(n / 8));
  const ch = data.prevTotal ? ((data.total - data.prevTotal) / data.prevTotal) * 100 : null;
  const empty = vals.every((v) => v === 0);

  function exportCsv() {
    const head = ["Metric", ...data.buckets.map((b) => label(b, grain, true)), "Total or average"];
    const lines = data.rows.map((r) => {
      const avg = r.primary && (data.rows.length > 1 || r.kind === "percent") ? data.total : r.values.reduce((a, b) => a + b, 0);
      const cell = (v: number) => (r.kind === "money" ? (v / 100).toFixed(2) : r.kind === "percent" ? v.toFixed(2) : String(Math.round(v)));
      return [r.label, ...r.values.map(cell), cell(avg)];
    });
    const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `etivio-${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="et-card et-ch-main">
      <header className="et-ch-head">
        <div>
          <h2>
            {title}
            <span className="et-ch-info" title={desc}>
              <Info size={14} />
            </span>
          </h2>
          <div className="et-ch-total">
            <b>{fmt(data.total, data.kind)}</b>
            {ch !== null && (
              <small className={ch >= 0 ? "is-up" : "is-down"}>
                {ch >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {Math.abs(ch).toFixed(0)}% vs previous {days} days
              </small>
            )}
          </div>
          <p>{desc}</p>
        </div>
        <div className="et-ch-seg">
          <button type="button" className={type === "line" ? "is-on" : ""} onClick={() => setType("line")} aria-label="Line chart">
            <ChartSpline size={15} /> Line
          </button>
          <button type="button" className={type === "bar" ? "is-on" : ""} onClick={() => setType("bar")} aria-label="Bar chart">
            <ChartColumn size={15} /> Bar
          </button>
        </div>
      </header>

      <div className="et-ch-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${title} chart`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="et-ch-grid" />
              <text x={PAD.l - 10} y={y(t) + 4} textAnchor="end" className="et-ch-axis">
                {fmt(t, main.kind)}
              </text>
            </g>
          ))}
          {data.buckets.map((b, i) =>
            i % every === 0 ? (
              <text key={b} x={type === "bar" ? bx(i) : x(i)} y={H - 10} textAnchor="middle" className="et-ch-axis">
                {label(b, grain === "week" ? "day" : grain)}
              </text>
            ) : null,
          )}
          {type === "line" ? (
            <>
              <path d={path} className="et-ch-line" />
              {hover !== null && (
                <>
                  <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} className="et-ch-cursor" />
                  <circle cx={x(hover)} cy={y(vals[hover])} r={5} className="et-ch-dot" />
                </>
              )}
            </>
          ) : (
            vals.map((v, i) => (
              <rect key={i} x={bx(i) - barW / 2} y={y(v)} width={barW} height={Math.max(0, PAD.t + ih - y(v))} className={`et-ch-bar${hover === i ? " is-on" : ""}`} />
            ))
          )}
          {vals.map((_, i) => (
            <rect
              key={`h${i}`}
              x={PAD.l + (iw / n) * i}
              y={PAD.t}
              width={iw / n}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
        {hover !== null && (
          <div className="et-ch-tip-box" style={{ left: `${((type === "bar" ? bx(hover) : x(hover)) / W) * 100}%` }}>
            <small>{label(data.buckets[hover], grain, true)}</small>
            {data.rows.map((r) => (
              <span key={r.label}>
                {r.label}: <b>{exact(r.values[hover], r.kind)}</b>
              </span>
            ))}
          </div>
        )}
        {empty && <p className="et-ch-empty">No data in this period yet.</p>}
      </div>

      <div className="et-ch-table-head">
        <h3>{title}: data</h3>
        <button type="button" className="et-btn et-btn-ghost" onClick={exportCsv}>
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="et-ch-table">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              {data.buckets.map((b) => (
                <th key={b}>{label(b, grain === "week" ? "day" : grain)}</th>
              ))}
              <th className="is-sticky">{data.rows.length > 1 || data.kind === "percent" ? "Period" : "Total"}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const sum = r.values.reduce((a, b) => a + b, 0);
              const whole = r.primary && (data.rows.length > 1 || r.kind === "percent") ? data.total : sum;
              return (
                <tr key={r.label} className={r.primary ? "is-primary" : ""}>
                  <td>{r.label}</td>
                  {r.values.map((v, i) => (
                    <td key={i}>{exact(v, r.kind)}</td>
                  ))}
                  <td className="is-sticky">{exact(whole, r.kind)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
