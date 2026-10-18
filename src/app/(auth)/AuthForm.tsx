"use client";
import { useState, useSyncExternalStore } from "react";
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

  // Set by /auth/callback when a Google or email-link sign-in fails.
  const callbackFailed = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("error") === "auth",
    () => false,
  );

  async function withGoogle() {
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}` },
    });
    // On success the browser leaves for Google, so only failures land here.
    if (error) {
      setError("Google sign-in isn't available right now.");
      setPending(false);
    }
  }

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
      {(error || callbackFailed) && <p className="et-auth-msg is-err">{error ?? "Sign-in didn't complete. Please try again."}</p>}
      <button type="button" className="et-auth-google" onClick={withGoogle} disabled={pending}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
        </svg>
        Continue with Google
      </button>
      <div className="et-auth-or">
        <span>or with email</span>
      </div>
      <form onSubmit={onSubmit}>
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
