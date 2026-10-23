import type { Metadata, Viewport } from "next";
import { siteUrl } from "@/lib/email/site";
import { Suspense } from "react";
import { VisitTracker } from "@/components/analytics/VisitTracker";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { DialogHost } from "@/components/dash/dialogs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Every relative URL in metadata (canonical links, share images) resolves against the live domain, never a
  // Vercel preview address.
  metadataBase: new URL(siteUrl()),
  title: "Etivio Africa",
  description: "Practical courses, templates and e-books from instructors across Africa. Learn at your own pace and earn certificates you can share.",
  applicationName: "Etivio",
  openGraph: { siteName: "Etivio", locale: "en_NG", type: "website" },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
  // Added to the iPhone home screen, Etivio opens full screen like an app.
  appleWebApp: { capable: true, title: "Etivio", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  // Lets pages run under the notch and home bar; layouts pad with env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegisterServiceWorker />
        <DialogHost />
        <Suspense fallback={null}>
          <VisitTracker />
        </Suspense>
      </body>
    </html>
  );
}
