"use client";
import { useTheme } from "@/lib/theme";

export function AuthFrame({
  children,
  title = "Learn the skills that move you forward.",
  body = "Courses from instructors across Africa, built for how you actually learn.",
  tag = "Etivio Africa",
}: {
  children: React.ReactNode;
  title?: string;
  body?: string;
  tag?: string;
}) {
  const { light } = useTheme();
  return (
    <div className={`et-auth${light ? " is-light" : ""}`}>
      <aside className="et-auth-side">
        <div className="et-auth-logo">
          <span>e</span>Etivio
        </div>
        <div>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <small style={{ opacity: 0.7 }}>{tag}</small>
      </aside>
      <main className="et-auth-main">{children}</main>
    </div>
  );
}
