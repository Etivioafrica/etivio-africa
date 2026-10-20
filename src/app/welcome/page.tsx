import type { Metadata } from "next";
import { Welcome } from "./Welcome";
import "./welcome.css";

export const metadata: Metadata = { title: "Welcome to Etivio", robots: { index: false } };

// Start screen of the installed app (manifest start_url and the iOS app). Signed-in people skip straight to the
// dashboard (see the proxy).
export default function WelcomePage() {
  return <Welcome />;
}
