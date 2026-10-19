import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { AvatarEditor } from "@/components/dash/AvatarEditor";
import { requireAdmin } from "@/lib/admin";
import { saveAdminProfile } from "./actions";

export const metadata = { title: "Settings" };

export default async function AdminProfileSettings() {
  const { admin } = await requireAdmin("settings");

  return (
    <section className="et-card">
      <div className="et-card-head">
        <h2>Your profile</h2>
      </div>
      <div className="et-card-pad">
        <ActionForm action={saveAdminProfile} toast>
          <div className="et-field">
            <label>Photo</label>
            <AvatarEditor variant="row" url={admin.avatarUrl} initial={(admin.name || admin.email).charAt(0).toUpperCase()} />
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
  );
}
