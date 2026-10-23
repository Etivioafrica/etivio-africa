import "server-only";

// Network helpers for video calls. STUN finds a direct route; Cloudflare's TURN relay carries the call when a
// direct route isn't possible (common on mobile data). Without CF_TURN_KEY_ID and CF_TURN_API_TOKEN, calls fall back
// to STUN only, which works on most home and office networks.
export async function iceServers(): Promise<RTCIceServer[]> {
  const fallback: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];
  const id = process.env.CF_TURN_KEY_ID;
  const token = process.env.CF_TURN_API_TOKEN;
  if (!id || !token) return fallback;
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 86400 }),
      cache: "no-store",
    });
    if (!r.ok) return fallback;
    const d = await r.json();
    const list = Array.isArray(d) ? d : d.iceServers;
    return Array.isArray(list) && list.length ? list : fallback;
  } catch {
    return fallback;
  }
}
