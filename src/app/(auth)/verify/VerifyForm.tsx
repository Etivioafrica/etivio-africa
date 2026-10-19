"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(app)/actions";

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/learn";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/learn";
}

// Second step of sign-in for accounts with an authenticator app.
export function VerifyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === "verified");
    if (!factor) {
      router.replace(nextPath());
      return;
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      setError("That code didn't work. Check your app and try again.");
      setPending(false);
      return;
    }
    router.replace(nextPath());
    router.refresh();
  }

  return (
    <div className="et-auth-box">
      <h1>Two-step verification</h1>
      <p className="et-auth-sub">Enter the 6-digit code from your authenticator app.</p>
      {error && <p className="et-auth-msg is-err">{error}</p>}
      <form onSubmit={onSubmit}>
        <label>
          Code
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="123 456"
            required
            autoFocus
            className="et-auth-code"
          />
        </label>
        <button type="submit" className="et-auth-submit" disabled={pending}>
          {pending ? "Checking…" : (
            <>
              Verify <ArrowRight size={16} strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>
      <form action={signOut}>
        <p className="et-auth-alt">
          Lost your device? <button type="submit" className="et-auth-textbtn">Sign out</button> and contact support.
        </p>
      </form>
    </div>
  );
}
