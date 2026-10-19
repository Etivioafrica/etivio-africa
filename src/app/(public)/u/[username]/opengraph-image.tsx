import { ImageResponse } from "next/og";
import { getPublicProfile } from "@/lib/data/public-profile";
import { normalizeUsername } from "@/lib/username";

export const alt = "Etivio learner profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share card for /@username links (WhatsApp, X, LinkedIn previews).
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const data = await getPublicProfile(normalizeUsername(decodeURIComponent((await params).username)));
  const name = data?.profile.name ?? "Etivio";
  const avatar = data?.profile.avatarUrl;
  // The image renderer can't decode WebP, so WebP avatars fall back to the initial.
  const photo = avatar && !/\.webp($|\?)/i.test(avatar) ? avatar : null;

  const stats = data
    ? [
        { label: "Lessons", value: data.stats.lessonsDone },
        { label: "Courses completed", value: data.stats.completed },
        { label: "Certificates", value: data.certificates.length },
        { label: "Active days", value: data.heatmap.activeDays },
      ]
    : [];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "#070b14", color: "#f1f5fb", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#3b82f6", letterSpacing: -1 }}>etivio</div>
          <div style={{ display: "flex", fontSize: 24, color: "#8a94a8" }}>{data?.profile.username ? `etivio.co/@${data.profile.username}` : "etivio.co"}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={180} height={180} alt="" style={{ borderRadius: 999, border: "6px solid #2563eb", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 180, height: 180, borderRadius: 999, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 84, fontWeight: 700 }}>
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 820 }}>
            <div style={{ display: "flex", fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>{name}</div>
            {data?.profile.headline && <div style={{ display: "flex", fontSize: 32, color: "#aab4c8" }}>{data.profile.headline}</div>}
            {data && data.skills.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {data.skills.slice(0, 4).map((s) => (
                  <div key={s} style={{ display: "flex", padding: "8px 18px", borderRadius: 999, background: "#2563eb", fontSize: 22, fontWeight: 600 }}>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "20px 26px", borderRadius: 20, background: "#0f1626", border: "2px solid #1b2538" }}>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>{s.value}</div>
              <div style={{ display: "flex", fontSize: 20, color: "#8a94a8" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
