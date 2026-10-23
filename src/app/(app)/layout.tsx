import { Suspense } from "react";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import Shell from "@/components/shell/Shell";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { showsTeach } from "@/lib/roles";
import "./app.css";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Etivio" },
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthedShell>{children}</AuthedShell>
    </Suspense>
  );
}

async function AuthedShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Re-read whenever the layout re-renders (full loads and refresh() after actions), so a badge earned
  // without a navigation still triggers the celebration.
  const supabase = await createClient();
  const [{ data: unseen }, jar] = await Promise.all([supabase.from("user_badges").select("badge_id").eq("user_id", user.id).is("seen_at", null), cookies()]);
  return (
    <Shell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        avatarUrl: user.avatarUrl,
        showTeach: showsTeach(user.roles, user.tutorApplication),
      }}
      needsOnboarding={user.needsOnboarding}
      lastSide={jar.get("et-side")?.value === "teach" ? "teach" : "learn"}
      unseenBadges={(unseen ?? []).map((b) => b.badge_id).join(",")}
    >
      {children}
    </Shell>
  );
}

function ShellSkeleton() {
  return (
    <div className="et-app is-light">
      <aside className="et-sidebar et-hide-sm">
        <div className="et-sidebar-top">
          <img src="/etiviologo.svg" alt="Etivio" className="et-brand-logo" />
        </div>
        <div className="et-nav">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="et-skel" style={{ height: 34, marginBottom: 6 }} />
          ))}
        </div>
      </aside>
      <div className="et-body">
        <header className="et-header" />
        <main className="et-main">
          <div className="et-page">
            <div className="et-skel" style={{ height: 44, width: 260 }} />
            <div className="et-stats">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="et-skel" style={{ height: 96 }} />
              ))}
            </div>
            <div className="et-skel" style={{ height: 280 }} />
          </div>
        </main>
      </div>
    </div>
  );
}
