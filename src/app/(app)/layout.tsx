import { Suspense } from "react";
import type { Metadata } from "next";
import Shell from "@/components/shell/Shell";
import { canTeach, getCurrentUser } from "@/lib/auth";
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
  return (
    <Shell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        canTeach: canTeach(user.role),
      }}
    >
      {children}
    </Shell>
  );
}

function ShellSkeleton() {
  return (
    <div className="et-app">
      <aside className="et-sidebar et-hide-sm">
        <div className="et-sidebar-top">
          <span className="et-brand-mark">e</span>
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
