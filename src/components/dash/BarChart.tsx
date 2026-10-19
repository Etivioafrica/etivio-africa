// Single-series bar chart. One measure per chart (no dual axes); the card title names the series.
// Hover tooltips come from TipLayer via data-tip. Renders on the server, no chart library.

type Point = { label: string; value: number; tip?: string };

function niceMax(n: number) {
  if (n <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n) ?? 10;
  return step * pow;
}

export function BarChart({
  data,
  format = (n) => n.toLocaleString("en-NG"),
  height = 180,
  ticks: wantedTicks = 4,
  integer = false,
}: {
  data: Point[];
  format?: (n: number) => string;
  height?: number;
  ticks?: number;
  // Counts (sign-ups, enrollments): keep the axis on whole numbers, never "0.25 sign-ups".
  integer?: boolean;
}) {
  let max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  let ticks = wantedTicks;
  if (integer) {
    max = Math.max(1, Math.ceil(max));
    ticks = [wantedTicks, 4, 3, 2, 1].find((t) => t <= max && max % t === 0) ?? 1;
  }
  const gridValues = Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * (ticks - i));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="et-chart" style={{ ["--h" as string]: `${height}px` }}>
      <div className="et-chart-y" aria-hidden>
        {gridValues.map((v) => (
          <span key={v}>{format(v)}</span>
        ))}
      </div>
      <div className="et-chart-plot">
        <div className="et-chart-grid" aria-hidden>
          {gridValues.map((v) => (
            <span key={v} />
          ))}
        </div>
        <div className="et-chart-bars" role="list">
          {data.map((d) => (
            <div key={d.label} className="et-chart-col" role="listitem" data-tip={d.tip ?? `${d.label}: ${format(d.value)}`}>
              <span className="et-chart-bar" style={{ height: `${(d.value / max) * 100}%` }} aria-label={`${d.label}: ${format(d.value)}`} />
            </div>
          ))}
        </div>
        <div className="et-chart-x" aria-hidden>
          {data.map((d, i) => (
            <span key={d.label}>{i % labelEvery === 0 || i === data.length - 1 ? d.label : ""}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
