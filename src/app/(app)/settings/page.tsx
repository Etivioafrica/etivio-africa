import { PageHead } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { getCurrentUser } from "@/lib/auth";
import { updateProfile } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <div className="et-page" style={{ maxWidth: 720 }}>
      <PageHead title="Settings" sub="Manage your profile." />
      <section className="et-card">
        <div className="et-card-head">
          <h2>Profile</h2>
        </div>
        <div className="et-card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="et-avatar et-avatar-xl" /> : <span className="et-avatar et-avatar-xl">{initial}</span>}
            <div>
              <strong style={{ display: "block", fontSize: 15 }}>{user.name || "Your account"}</strong>
              <span style={{ fontSize: 12.5, color: "var(--a-faint)" }}>
                {user.email} · <span style={{ textTransform: "capitalize" }}>{user.role}</span>
              </span>
            </div>
          </div>
          <ActionForm action={updateProfile}>
            <div className="et-field">
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" defaultValue={user.name} autoComplete="name" />
            </div>
            <div className="et-field">
              <label htmlFor="avatar_url">Avatar URL</label>
              <input id="avatar_url" name="avatar_url" type="url" defaultValue={user.avatarUrl ?? ""} placeholder="https://" />
            </div>
            <div className="et-field">
              <label htmlFor="bio">Bio</label>
              <textarea id="bio" name="bio" rows={4} defaultValue={user.bio ?? ""} />
              <small>Shown on your courses if you teach.</small>
            </div>
            <div className="et-form-foot">
              <SubmitButton>Save profile</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
