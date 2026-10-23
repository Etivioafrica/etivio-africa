"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { confirmDialog } from "@/components/dash/dialogs";

type Enrolling = { factorId: string; qr: string; secret: string };

// Authenticator-app (TOTP) two-step verification via Supabase MFA.
export function TwoFactor({ factorId }: { factorId: string | null }) {
  const router = useRouter();
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // Clear half-finished setups so they don't pile up.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${Date.now()}`, issuer: "Etivio" });
    setBusy(false);
    if (error || !data) return setError(error?.message ?? "Could not start setup.");
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enrolling) return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code });
    setBusy(false);
    if (error) return setError("That code didn't work. Codes refresh every 30 seconds, so try the latest one.");
    setEnrolling(null);
    router.refresh();
  }

  async function cancel() {
    if (enrolling) await createClient().auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null);
    setError(null);
  }

  async function disable() {
    if (!factorId) return;
    const ok = await confirmDialog({ title: "Turn off two-step verification?", body: "Your account will only be protected by your password.", confirmLabel: "Turn off", danger: true });
    if (!ok) return;
    setBusy(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  if (factorId)
    return (
      <div className="et-set-box">
        <div className="et-set-box-row">
          <span className="et-inline" style={{ flexWrap: "nowrap" }}>
            <ShieldCheck size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <span>
              <b>Authenticator app is on</b>
              <small>We ask for a code each time you sign in.</small>
            </span>
          </span>
          <button type="button" className="et-btn et-btn-danger-text et-btn-sm" onClick={disable} disabled={busy}>
            Turn off
          </button>
        </div>
        {error && <p className="et-set-saved is-err">{error}</p>}
      </div>
    );

  if (enrolling)
    return (
      <form className="et-set-box et-2fa" onSubmit={confirm}>
        <div className="et-2fa-setup">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="QR code for your authenticator app" />
          <ol>
            <li>Open Google Authenticator, Authy, or 1Password.</li>
            <li>Scan this QR code, or enter the key below.</li>
            <li>Type the 6-digit code it shows.</li>
          </ol>
        </div>
        <div className="et-2fa-secret">
          <small>Setup key</small>
          <code>{enrolling.secret}</code>
        </div>
        <div className="et-2fa-confirm">
          <input
            name="code"
            className="et-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="123 456"
            required
            autoFocus
            aria-label="6-digit code"
          />
          <button type="submit" className="et-btn et-btn-primary" disabled={busy}>
            {busy ? "Checking…" : "Turn on"}
          </button>
          <button type="button" className="et-btn et-btn-ghost" onClick={cancel} disabled={busy}>
            Cancel
          </button>
        </div>
        {error && <p className="et-set-saved is-err">{error}</p>}
      </form>
    );

  return (
    <div className="et-set-box">
      <div className="et-set-box-row">
        <span>
          <b>Authenticator app</b>
          <small>Off. Add a code from your phone on top of your password.</small>
        </span>
        <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Set up"}
        </button>
      </div>
      {error && <p className="et-set-saved is-err">{error}</p>}
    </div>
  );
}
