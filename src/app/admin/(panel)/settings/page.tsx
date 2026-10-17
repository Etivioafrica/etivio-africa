import { PageHead } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { Uploader } from "@/components/dash/Uploader";
import { requireAdmin } from "@/lib/admin";
import { saveAdminProfile, savePlatformSettings } from "./actions";

export const metadata = { title: "Settings" };

export default async function AdminSettings() {
  const { admin, db } = await requireAdmin("settings");
  const { data: settings } = await db.from("platform_settings").select("*").single();

  return (
    <div className="et-page" style={{ maxWidth: 900 }}>
      <PageHead title="Settings" />
      <div className="et-grid-2">
        <section className="et-card">
          <div className="et-card-head">
            <h2>Your profile</h2>
          </div>
          <div className="et-card-pad">
            <ActionForm action={saveAdminProfile}>
              <div className="et-field">
                <label>Photo</label>
                <Uploader name="avatar_url" kind="avatar" defaultUrl={admin.avatarUrl} label="Upload a photo" />
              </div>
              <div className="et-field">
                <label htmlFor="full_name">Name</label>
                <input id="full_name" name="full_name" defaultValue={admin.name} required />
              </div>
              <div className="et-field">
                <label>Email</label>
                <input value={admin.email} disabled readOnly />
              </div>
              <div className="et-form-foot">
                <SubmitButton>Save profile</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </section>
        <section className="et-card">
          <div className="et-card-head">
            <h2>Platform</h2>
          </div>
          <div className="et-card-pad">
            {admin.isSuper ? (
              <ActionForm action={savePlatformSettings}>
                <div className="et-field">
                  <label htmlFor="commission_percent">Platform commission (%)</label>
                  <input id="commission_percent" name="commission_percent" type="number" min={0} max={100} step="0.5" defaultValue={Number(settings?.commission_percent ?? 20)} />
                  <small>Etivio&apos;s share of each course sale. The rest goes to the instructor.</small>
                </div>
                <div className="et-field">
                  <label htmlFor="support_email">Support email</label>
                  <input id="support_email" name="support_email" type="email" defaultValue={settings?.support_email ?? ""} placeholder="support@etivio.co" />
                </div>
                <div className="et-form-foot">
                  <SubmitButton>Save settings</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <dl className="et-kv">
                <dt>Commission</dt>
                <dd>{Number(settings?.commission_percent ?? 20)}%</dd>
                <dt>Support email</dt>
                <dd>{settings?.support_email || "Not set"}</dd>
              </dl>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
