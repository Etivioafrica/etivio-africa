import type { Metadata } from "next";
import "../(app)/app.css";
import "@/components/coaching/coaching.css";

export const metadata: Metadata = {
  title: { default: "Session", template: "%s | Etivio" },
  robots: { index: false, follow: false },
};

// Session calls are full screen: no sidebar, just the call.
export default function CallLayout({ children }: { children: React.ReactNode }) {
  return children;
}
