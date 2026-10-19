import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { changePassword } from "@/app/(app)/settings/actions";
import { TwoFactor } from "@/app/(app)/settings/security/TwoFactor";

export const metadata = { title: "Security" };

// Your own admin account: password and two-step verification (strongly recommended for staff).
export default async function AdminSecurity() {
  await requireAdmin("settings");
  const user = await getCurrentUser();
  const hasPassword = user.providers.includes("email");
  const { data: factors } = await (await createClient()).auth.mfa.listFactors();
  const totp = factors?.totp.find((f) => f.status === "verified") ?? null;

  return (
    <div className="et-grid-2">
      <section className="et-card">
        <div className="et-card-head">
          <h2>{hasPassword ? "Password" : "Set a password"}</h2>
        </div>
        <div className="et-card-pad">
          <ActionForm action={changePassword} toast>
            {hasPassword && (
              <div className="et-field">
                <label htmlFor="current_password">Current password</label>
                <input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
              </div>
            )}
            <div className="et-field">
              <label htmlFor="new_password">New password</label>
              <input id="new_password" name="new_password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="et-field">
              <label htmlFor="confirm_password">Confirm new password</label>
              <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="et-form-foot">
              <SubmitButton>{hasPassword ? "Update password" : "Set password"}</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Two-step verification</h2>
          {!totp && <span className="et-status et-status-amber">Recommended</span>}
        </div>
        <div className="et-card-pad">
          <p className="et-muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Admin accounts can see every learner and every payment. A code from your phone on each sign-in keeps them safe even if your password leaks.
          </p>
          <TwoFactor factorId={totp?.id ?? null} />
        </div>
      </section>
    </div>
  );
}
