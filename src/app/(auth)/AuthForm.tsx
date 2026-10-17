"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/learn";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/learn";
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message === "Email not confirmed" ? "Confirm your email first. Check your inbox for the link." : "Incorrect email or password.");
        setPending(false);
        return;
      }
      router.replace(nextPath());
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: String(fd.get("name") ?? "").trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/learn`,
      },
    });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    if (data.session) {
      router.replace("/learn");
      router.refresh();
    } else {
      setSent(true);
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="et-auth-card">
        <div>
          <h1>Check your email</h1>
          <p>We sent you a confirmation link. Open it to finish creating your account.</p>
        </div>
        <p className="et-auth-alt">
          Already confirmed? <Link href="/login">Sign in</Link>
        </p>
      </div>
    );
  }

  const login = mode === "login";
  return (
    <div className="et-auth-card">
      <div>
        <h1>{login ? "Welcome back" : "Create your account"}</h1>
        <p>{login ? "Sign in to continue learning." : "Start learning in minutes. It's free."}</p>
      </div>
      <form onSubmit={onSubmit}>
        {error && <p className="et-auth-msg is-err">{error}</p>}
        {!login && (
          <label>
            Full name
            <input name="name" autoComplete="name" required />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={login ? "current-password" : "new-password"}
            minLength={login ? undefined : 8}
            required
          />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Please wait…" : login ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="et-auth-alt">
        {login ? (
          <>
            New to Etivio? <Link href="/signup">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        )}
      </p>
    </div>
  );
}
