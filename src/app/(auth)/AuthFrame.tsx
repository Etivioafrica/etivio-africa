"use client";
import { useTheme } from "@/lib/theme";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { light } = useTheme();
  return (
    <div className={`et-auth${light ? " is-light" : ""}`}>
      <aside className="et-auth-side">
        <div className="et-auth-logo">
          <span>e</span>Etivio
        </div>
        <div>
          <h2>Learn the skills that move you forward.</h2>
          <p>Courses from instructors across Africa, built for how you actually learn.</p>
        </div>
        <small style={{ opacity: 0.7 }}>Etivio Africa</small>
      </aside>
      <main className="et-auth-main">{children}</main>
    </div>
  );
}
