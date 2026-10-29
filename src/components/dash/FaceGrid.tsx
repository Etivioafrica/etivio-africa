// Flat illustrated faces for the dashboard banner: eight learners, each on a solid colour tile.

type Style = "braids" | "beard" | "afro" | "gele" | "short" | "hijab" | "locs" | "bun";
type Face = { bg: string; skin: string; hair: string; shirt: string; style: Style; glasses?: boolean; dots?: boolean };

const FACES: Face[] = [
  { bg: "#2563eb", skin: "#8d5524", hair: "#1b120d", shirt: "#f97316", style: "braids" },
  { bg: "#6d28d9", skin: "#5a3418", hair: "#140d09", shirt: "#22c55e", style: "beard", dots: true },
  { bg: "#60a5fa", skin: "#a0663a", hair: "#1b120d", shirt: "#1e3a8a", style: "afro" },
  { bg: "#16a34a", skin: "#6b3e1f", hair: "#facc15", shirt: "#6d28d9", style: "gele", dots: true },
  { bg: "#f97316", skin: "#c68642", hair: "#2b1a12", shirt: "#2563eb", style: "short", glasses: true },
  { bg: "#facc15", skin: "#7a4a2a", hair: "#1e3a8a", shirt: "#1e3a8a", style: "hijab" },
  { bg: "#1e3a8a", skin: "#8d5524", hair: "#140d09", shirt: "#facc15", style: "locs", dots: true },
  { bg: "#e11d48", skin: "#5a3418", hair: "#140d09", shirt: "#ffffff", style: "bun" },
];

const INK = "#24140c";

function FaceTile({ f }: { f: Face }) {
  const showEars = f.style !== "hijab" && f.style !== "braids";
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="100" fill={f.bg} />

      {/* Hair or scarf behind the head */}
      {f.style === "afro" && <circle cx="50" cy="40" r="29" fill={f.hair} />}
      {f.style === "braids" && <path d="M28 42 Q27 21 50 21 Q73 21 72 42 L77 96 L23 96Z" fill={f.hair} />}
      {f.style === "hijab" && <path d="M25 56 Q24 21 50 21 Q76 21 75 56 L83 100 L17 100Z" fill={f.hair} />}
      {f.style === "locs" &&
        [27, 33, 39, 61, 67, 73].map((x) => <rect key={x} x={x - 3} y="34" width="6" height="44" rx="3" fill={f.hair} />)}
      {f.style === "bun" && <circle cx="50" cy="24" r="9.5" fill={f.hair} />}

      {/* Shoulders and neck */}
      {f.style !== "hijab" && <path d="M14 100 Q16 80 50 78 Q84 80 86 100Z" fill={f.shirt} />}
      <rect x="43" y="64" width="14" height="16" rx="4" fill={f.skin} />

      {/* Head */}
      {showEars && (
        <>
          <circle cx="31.5" cy="54" r="4.5" fill={f.skin} />
          <circle cx="68.5" cy="54" r="4.5" fill={f.skin} />
        </>
      )}
      <ellipse cx="50" cy="52" rx="19" ry="22" fill={f.skin} />

      {/* Hair in front */}
      {(f.style === "afro" || f.style === "short" || f.style === "bun" || f.style === "locs") && (
        <path d="M31 48 Q30 29 50 28.5 Q70 29 69 48 Q63 37 50 37.5 Q37 37 31 48Z" fill={f.hair} />
      )}
      {f.style === "braids" && <path d="M31 50 Q29 28 50 27 Q71 28 69 50 Q63 34 50 34 Q37 34 31 50Z" fill={f.hair} />}
      {f.style === "gele" && (
        <>
          <path d="M26 45 Q22 16 50 14 Q80 15 74 45 Q65 33 50 33 Q35 33 26 45Z" fill={f.hair} />
          <circle cx="69" cy="19" r="9" fill={f.hair} />
        </>
      )}
      {f.style === "beard" && <path d="M31 53 Q31 79 50 81 Q69 79 69 53 Q66 66 50 66 Q34 66 31 53Z" fill={f.hair} />}

      {/* Eyes: dots or happy arcs */}
      {f.dots ? (
        <>
          <circle cx="43" cy="52" r="2.4" fill={INK} />
          <circle cx="57" cy="52" r="2.4" fill={INK} />
        </>
      ) : (
        <path d="M40 53 q3 -3.6 6 0 M54 53 q3 -3.6 6 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      )}
      {f.glasses && (
        <path d="M36.5 52.5 a6.5 6.5 0 1 0 13 0 a6.5 6.5 0 1 0 -13 0 M50.5 52.5 a6.5 6.5 0 1 0 13 0 a6.5 6.5 0 1 0 -13 0 M49.5 52 h1" stroke={INK} strokeWidth="2" fill="none" />
      )}

      {/* Smile */}
      <path d="M43 61 Q50 69.5 57 61 Z" fill="#ffffff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function FaceGrid() {
  return (
    <div className="et-faces" aria-hidden="true">
      {FACES.map((f, i) => (
        <FaceTile key={i} f={f} />
      ))}
    </div>
  );
}
