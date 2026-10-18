"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
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
  const [show, setShow] = useState(false);

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
    <div className="et-auth-box">
      <h1>Admin sign in</h1>
      <p className="et-auth-sub">For Etivio staff only.</p>
      {error && <p className="et-auth-msg is-err">{error}</p>}
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" placeholder="you@etivio.co" required />
        </label>
        <label>
          Password
          <span className="et-auth-pw">
            <input name="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Your password" required />
            <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <button type="submit" className="et-auth-submit" disabled={pending}>
          {pending ? "Checking access…" : (
            <>
              Sign in <ArrowRight size={16} strokeWidth={2.5} />
            </>
          )}
        </button>
        <Link href="/forgot-password" className="et-auth-link">
          Forgot password?
        </Link>
      </form>
    </div>
  );
}
