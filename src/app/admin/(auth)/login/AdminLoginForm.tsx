"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmAdminAccess } from "../../actions";

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/admin";
  return next.startsWith("/admin") ? next : "/admin";
}

export function AdminLoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email") ?? "").trim(),
      password: String(fd.get("password") ?? ""),
    });
    if (error) {
      setError(error.message === "Email not confirmed" ? "Confirm your email first." : "Incorrect email or password.");
      setPending(false);
      return;
    }
    const { ok } = await confirmAdminAccess();
    if (!ok) {
      setError("This account doesn't have admin access.");
      setPending(false);
      return;
    }
    router.replace(nextPath());
    router.refresh();
  }

  return (
    <div className="et-auth-card">
      <div>
        <h1>Admin sign in</h1>
        <p>For Etivio staff only.</p>
      </div>
      <form onSubmit={onSubmit}>
        {error && <p className="et-auth-msg is-err">{error}</p>}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Checking access…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
