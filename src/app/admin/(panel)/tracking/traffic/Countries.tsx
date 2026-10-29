export type Row = { key: string; visits: number; visitors: number; bounces: number; signups: number };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");
const regions = new Intl.DisplayNames(["en"], { type: "region" });
const country = (code: string) => {
  if (code === "??") return "Unknown";
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
};

// A country's flag from its two-letter code (regional indicator letters).
const flag = (code: string) => (/^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : "🌐");

// Where visitors are from: each country's share of visitors, its visits and sign-ups, and its busiest cities.
export function Countries({ countries, cities, visitors }: { countries: Row[]; cities: Row[]; visitors: number }) {
  const top = Math.max(1, ...countries.map((r) => r.visitors));
  const known = countries.filter((r) => r.key !== "??").length;
  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>Where visitors come from</h2>
        <small>
          {known} {known === 1 ? "country" : "countries"}
        </small>
      </div>
      {countries.length ? (
        <table className="et-table et-geo">
          <thead>
            <tr>
              <th>Country</th>
              <th>Top cities</th>
              <th className="et-th-right">Visitors</th>
              <th className="et-th-right">Share</th>
              <th className="et-th-right">Visits</th>
              <th className="et-th-right">Sign-ups</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((r) => {
              const towns = cities.filter((c) => c.key.endsWith(`, ${r.key}`)).slice(0, 3);
              return (
                <tr key={r.key}>
                  <td>
                    <span className="et-geo-name">
                      <i aria-hidden="true">{flag(r.key)}</i>
                      <b>{country(r.key)}</b>
                    </span>
                    <span className="et-geo-bar" style={{ width: `${(r.visitors / top) * 100}%` }} />
                  </td>
                  <td className="et-geo-cities">{towns.length ? towns.map((c) => c.key.replace(`, ${r.key}`, "")).join(", ") : "–"}</td>
                  <td className="et-td-right">{r.visitors.toLocaleString("en-NG")}</td>
                  <td className="et-td-right">{pct(r.visitors, visitors)}</td>
                  <td className="et-td-right">{r.visits.toLocaleString("en-NG")}</td>
                  <td className="et-td-right">{r.signups}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="et-empty">No visits recorded yet. Countries come from the visitor&apos;s connection on the live site.</p>
      )}
    </section>
  );
}

