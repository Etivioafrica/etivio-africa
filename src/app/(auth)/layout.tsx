import type { Viewport } from "next";
import { AuthFrame } from "./AuthFrame";
import "./auth.css";

// Sign-in screens behave like an app on phones: no pinch zoom (inputs are 16px, so iOS doesn't zoom on focus either).
export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
