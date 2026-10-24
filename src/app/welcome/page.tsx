import type { Metadata, Viewport } from "next";
import { Welcome } from "./Welcome";
import "./welcome.css";

export const metadata: Metadata = { title: "Welcome to Etivio", robots: { index: false } };
// Locked like an app screen: no pinch zoom.
export const viewport: Viewport = { themeColor: "#2563eb", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover" };

// Start screen of the installed app (manifest start_url and the iOS app). Signed-in people skip straight to the
// dashboard (see the proxy).
export default function WelcomePage() {
  return <Welcome />;
}
