"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot" | "reset";

const copy: Record<Mode, { title: string; sub: string; submit: string }> = {
  login: { title: "Welcome back", sub: "Sign in to continue learning.", submit: "Sign in" },
  signup: { title: "Create your account", sub: "Start learning in minutes. It's free.", submit: "Create account" },
  forgot: { title: "Reset your password", sub: "Enter your email and we'll send you a reset link.", submit: "Send reset link" },
  reset: { title: "Set a new password", sub: "Choose a new password for your account.", submit: "Update password" },
};

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/learn";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/learn";
}

function callbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

function PasswordField({ name, label, autoComplete, placeholder }: { name: string; label: string; autoComplete: string; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <span className="et-auth-pw">
        <input
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={autoComplete === "new-password" ? 8 : undefined}
          required
        />
        <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

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
      options: { redirectTo: callbackUrl(nextPath()) },
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
    const fail = (message: string) => {
      setError(message);
      setPending(false);
    };

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return fail(error.message === "Email not confirmed" ? "Confirm your email first. Check your inbox for the link." : "Incorrect email or password.");
      router.replace(nextPath());
      router.refresh();
      return;
    }

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl("/reset-password") });
      if (error) return fail("We couldn't send the link right now. Try again in a few minutes.");
      setSent("If an account exists for that email, a reset link is on its way. Open it in this browser to set a new password.");
      setPending(false);
      return;
    }

    if (mode === "reset") {
      if (password !== fd.get("confirm")) return fail("Passwords do not match.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        return fail(
          error.message.toLowerCase().includes("session")
            ? "This reset link has expired. Request a new one."
            : error.message,
        );
      }
      router.replace("/learn");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: String(fd.get("name") ?? "").trim() },
        emailRedirectTo: callbackUrl("/learn"),
      },
    });
    if (error) return fail(error.message);
    if (data.session) {
      router.replace("/learn");
      router.refresh();
      return;
    }
    setSent("We sent you a confirmation link. Open it to finish creating your account.");
    setPending(false);
  }

  const { title, sub, submit } = copy[mode];
  const withSocial = mode === "login" || mode === "signup";
  const message = error ?? (callbackFailed ? "Sign-in didn't complete. Please try again." : null);

  return (
    <div className="et-auth-box">
      {mode === "forgot" && (
        <Link href="/login" className="et-auth-back">
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      )}
      <h1>{sent && mode === "signup" ? "Check your email" : title}</h1>
      <p className="et-auth-sub">{sent && mode === "signup" ? "One more step." : sub}</p>
      {message && <p className="et-auth-msg is-err">{message}</p>}

      {sent ? (
        <>
          <div className="et-auth-sent">{sent}</div>
          <p className="et-auth-alt">
            <Link href="/login">Back to sign in</Link>
          </p>
        </>
      ) : (
        <>
          {withSocial && (
            <>
              <button type="button" className="et-auth-google" onClick={withGoogle} disabled={pending}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
                  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
                </svg>
                {mode === "signup" ? "Sign up with Google" : "Continue with Google"}
              </button>
              <div className="et-auth-or">
                <span>or with email</span>
              </div>
            </>
          )}
          <form onSubmit={onSubmit}>
            {mode === "signup" && (
              <label>
                Full name
                <input name="name" autoComplete="name" placeholder="Ada Okafor" required />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Email
                <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              </label>
            )}
            {mode === "login" && <PasswordField name="password" label="Password" autoComplete="current-password" placeholder="Your password" />}
            {mode === "signup" && <PasswordField name="password" label="Password" autoComplete="new-password" placeholder="Minimum 8 characters" />}
            {mode === "reset" && (
              <>
                <PasswordField name="password" label="New password" autoComplete="new-password" placeholder="Minimum 8 characters" />
                <PasswordField name="confirm" label="Confirm password" autoComplete="new-password" placeholder="Repeat your new password" />
              </>
            )}
            <button type="submit" className="et-auth-submit" disabled={pending}>
              {pending ? "Please wait…" : (
                <>
                  {submit} <ArrowRight size={16} strokeWidth={2.5} />
                </>
              )}
            </button>
            {mode === "login" && (
              <Link href="/forgot-password" className="et-auth-link">
                Forgot password?
              </Link>
            )}
          </form>
        </>
      )}
    </div>
  );
}
