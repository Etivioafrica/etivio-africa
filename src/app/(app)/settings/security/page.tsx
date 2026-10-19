import { LogOut } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { changePassword, signOutEverywhere } from "../actions";
import { SetRow } from "../SetRow";
import { TwoFactor } from "./TwoFactor";

export const metadata = { title: "Security" };

const PROVIDER_LABELS: Record<string, string> = { email: "Email and password", google: "Google" };

export default async function SecuritySettings() {
  const user = await getCurrentUser();
  const hasPassword = user.providers.includes("email");
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp.find((f) => f.status === "verified") ?? null;

  return (
    <>
      <SetRow
        title={hasPassword ? "Password" : "Set a password"}
        sub={hasPassword ? "Use at least 8 characters you don't use anywhere else." : "You sign in with Google. Add a password to also sign in with your email."}
      >
        <ActionForm action={changePassword}>
          {hasPassword && (
            <div className="et-field">
              <label htmlFor="current_password">Current password</label>
              <input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
            </div>
          )}
          <div className="et-form-grid">
            <div className="et-field">
              <label htmlFor="new_password">New password</label>
              <input id="new_password" name="new_password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="et-field">
              <label htmlFor="confirm_password">Confirm password</label>
              <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
          </div>
          <div className="et-set-inline-foot">
            <SubmitButton className="et-btn et-btn-ghost">{hasPassword ? "Update password" : "Set password"}</SubmitButton>
          </div>
        </ActionForm>
      </SetRow>

      <SetRow title="Two-step verification" sub="Ask for a code from an authenticator app whenever you sign in, so a leaked password isn't enough.">
        <TwoFactor factorId={totp?.id ?? null} />
      </SetRow>

      <SetRow title="Sign-in methods" sub="Ways you can get into your account.">
        <div className="et-set-box">
          {user.providers.map((p) => (
            <div key={p} className="et-set-box-row">
              <b>{PROVIDER_LABELS[p] ?? p}</b>
              <span className="et-tag">Connected</span>
            </div>
          ))}
        </div>
      </SetRow>

      <SetRow title="Sessions" sub="Lost a device or signed in somewhere public? End every session at once.">
        <div className="et-set-box">
          <div className="et-set-box-row">
            <span>
              <b>Sign out everywhere</b>
              <small>Including this browser.</small>
            </span>
            <form action={signOutEverywhere}>
              <button type="submit" className="et-btn et-btn-danger-text et-btn-sm">
                <LogOut size={14} />
                Sign out all
              </button>
            </form>
          </div>
        </div>
      </SetRow>
    </>
  );
}
