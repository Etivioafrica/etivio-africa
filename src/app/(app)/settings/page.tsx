import Link from "next/link";
import { PageHead, Status } from "@/components/dash/ui";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { Uploader } from "@/components/dash/Uploader";
import { getCurrentUser } from "@/lib/auth";
import { CREATOR_ROLES, LIVE_CREATOR_ROLES, ROLE_BLURBS, ROLE_LABELS } from "@/lib/roles";
import { updateProfile } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <div className="et-page">
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
                {user.email} · {user.roles.map((r) => ROLE_LABELS[r]).join(", ")}
              </span>
            </div>
          </div>
          <ActionForm action={updateProfile}>
            <div className="et-field">
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" defaultValue={user.name} autoComplete="name" />
            </div>
            <div className="et-field">
              <label>Photo</label>
              <Uploader name="avatar_url" kind="avatar" defaultUrl={user.avatarUrl} label="Upload a photo" />
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

      <section className="et-card">
        <div className="et-card-head">
          <h2>Your roles on Etivio</h2>
        </div>
        <ul className="et-feed">
          {CREATOR_ROLES.map((r) => {
            const has = user.roles.includes(r);
            const live = LIVE_CREATOR_ROLES.includes(r);
            return (
              <li key={r}>
                <span style={{ flex: 1 }}>
                  <b>{ROLE_LABELS[r]}</b>
                  <br />
                  <small className="et-muted">{ROLE_BLURBS[r]}</small>
                </span>
                {has ? (
                  <Status value="active" />
                ) : live ? (
                  <Link href="/teach" className="et-btn et-btn-ghost et-btn-sm">
                    Apply
                  </Link>
                ) : (
                  <span className="et-tag">Coming soon</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
