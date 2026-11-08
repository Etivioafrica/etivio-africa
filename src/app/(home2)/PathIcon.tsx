// Custom 3D icon tiles for "Learning for every path": a raised blue tile (lit face over a darker base) with a
// two-tone glyph drawn for each audience. White for the main shape, light blue for the detail.
export type PathId = "students" | "jobs" | "switch" | "freelance" | "business" | "teams";

const W = "#ffffff";
const L = "#bcd0ff";

function Glyph({ id }: { id: PathId }) {
  switch (id) {
    case "students":
      return (
        <>
          <path d="M32 18 54 28 32 38 10 28Z" fill={W} />
          <path d="M19 32.5v8.5c0 3.5 6 7 13 7s13-3.5 13-7v-8.5L32 38Z" fill={L} />
          <path d="M50 30v11" stroke={W} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="50" cy="43.5" r="2.6" fill={W} />
        </>
      );
    case "jobs":
      return (
        <>
          <rect x="15" y="13" width="28" height="36" rx="4" fill={W} />
          <rect x="20" y="20" width="12" height="3.4" rx="1.7" fill={L} />
          <rect x="20" y="27" width="18" height="3" rx="1.5" fill={L} />
          <rect x="20" y="33" width="14" height="3" rx="1.5" fill={L} />
          <circle cx="44" cy="44" r="10" fill={L} stroke="#2148d6" strokeWidth="2.5" />
          <path d="m39.5 44 3 3 6-6" fill="none" stroke="#2148d6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "switch":
      return (
        <>
          <rect x="11" y="34" width="16" height="16" rx="4" fill={L} />
          <rect x="37" y="14" width="16" height="16" rx="4" fill={W} />
          <path d="M19 31c0-9 6-13 15-13" fill="none" stroke={W} strokeWidth="2.8" strokeLinecap="round" strokeDasharray="1 5" />
          <path d="m31 13 5 5-5 5" fill="none" stroke={W} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "freelance":
      return (
        <>
          <rect x="13" y="16" width="34" height="23" rx="3" fill={W} />
          <rect x="17" y="20" width="26" height="15" rx="1.5" fill={L} />
          <path d="M8 42h44l-3 5H11Z" fill={W} />
          <circle cx="48" cy="18" r="8" fill="#ffd166" stroke="#2148d6" strokeWidth="2.2" />
          <path d="M48 14.5v7M46 16.5h3.2a1.5 1.5 0 0 1 0 3H46" fill="none" stroke="#2148d6" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    case "business":
      return (
        <>
          <rect x="14" y="28" width="36" height="22" rx="2" fill={W} />
          <path d="M11 20h42l-2 9H13Z" fill={L} />
          <path d="M18 20l-1.5 9M25 20l-.5 9M32 20v9M39 20l.5 9M46 20l1.5 9" stroke="#2148d6" strokeWidth="1.6" />
          <rect x="27" y="36" width="10" height="14" rx="1.5" fill={L} />
          <rect x="17" y="34" width="7" height="6" rx="1" fill={L} />
          <rect x="40" y="34" width="7" height="6" rx="1" fill={L} />
        </>
      );
    case "teams":
      return (
        <>
          <circle cx="19" cy="25" r="5.5" fill={L} />
          <circle cx="45" cy="25" r="5.5" fill={L} />
          <path d="M9 45c0-6 4.5-10 10-10s10 4 10 10Z" fill={L} />
          <path d="M35 45c0-6 4.5-10 10-10s10 4 10 10Z" fill={L} />
          <circle cx="32" cy="22" r="7" fill={W} />
          <path d="M19 49c0-8 5.8-13 13-13s13 5 13 13Z" fill={W} />
        </>
      );
  }
}

export function PathIcon({ id }: { id: PathId }) {
  const g = `pi-${id}`;
  return (
    <svg className="et-h2-pi" viewBox="0 0 72 76" width="48" height="51" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b8cff" />
          <stop offset="1" stopColor="#1f45d8" />
        </linearGradient>
      </defs>
      <rect x="4" y="10" width="64" height="64" rx="16" fill="#122c8f" />
      <g className="et-h2-pi-face">
        <rect x="4" y="4" width="64" height="64" rx="16" fill={`url(#${g})`} />
        <rect x="4.75" y="4.75" width="62.5" height="62.5" rx="15.25" fill="none" stroke="#8fb0ff" strokeWidth="1.5" />
        <g transform="translate(4 4)">
          <Glyph id={id} />
        </g>
      </g>
    </svg>
  );
}
