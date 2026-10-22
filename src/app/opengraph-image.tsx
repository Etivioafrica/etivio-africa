import { ImageResponse } from "next/og";

export const alt = "Etivio: practical courses from instructors across Africa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The default share card (WhatsApp, X, LinkedIn previews) for pages without their own cover image.
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#070b14", color: "#f1f5fb", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#3b82f6", letterSpacing: -1 }}>etivio</div>
          <div style={{ display: "flex", fontSize: 26, color: "#8a94a8" }}>etivio.co</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>Learn practical skills.</div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05, color: "#3b82f6" }}>Track real progress.</div>
          <div style={{ display: "flex", fontSize: 30, color: "#8a94a8", marginTop: 8 }}>Courses, templates and e-books from instructors across Africa, with certificates you can share.</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["Courses", "Certificates", "Marketplace"].map((t) => (
            <div key={t} style={{ display: "flex", padding: "12px 22px", borderRadius: 999, background: "#2563eb", fontSize: 24, fontWeight: 600 }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
