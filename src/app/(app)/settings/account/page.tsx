import { Download } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { getCurrentUser } from "@/lib/auth";
import { changeEmail, deleteAccount } from "../actions";
import { SetRow } from "../SetRow";

export const metadata = { title: "Account" };

export default async function AccountSettings() {
  const user = await getCurrentUser();

  return (
    <>
      <SetRow title="Email address" sub="Used to sign in and for receipts. We confirm the change on both addresses.">
        <ActionForm action={changeEmail}>
          <div className="et-field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" defaultValue={user.email} autoComplete="email" required />
          </div>
          <div className="et-set-inline-foot">
            <SubmitButton pendingLabel="Sending…" className="et-btn et-btn-ghost">
              Change email
            </SubmitButton>
          </div>
        </ActionForm>
      </SetRow>

      <SetRow title="Export your data" sub="A copy of everything Etivio holds about you, as a JSON file.">
        <div className="et-set-box">
          <div className="et-set-box-row">
            <span>
              <b>Your Etivio data</b>
              <small>Profile, roles, courses, lesson progress, purchases, support chats, and applications.</small>
            </span>
            {/* Plain link: the route streams a file download. */}
            <a href="/api/export" className="et-btn et-btn-ghost et-btn-sm" download>
              <Download size={14} />
              Download
            </a>
          </div>
        </div>
      </SetRow>

      <SetRow title="Delete account" sub="You lose access to your courses straight away. Support can restore it within 30 days, then it's gone for good." danger>
        <ActionForm action={deleteAccount}>
          <div className="et-field">
            <label htmlFor="confirm">Type DELETE to confirm</label>
            <input id="confirm" name="confirm" autoComplete="off" required pattern="DELETE" />
          </div>
          <div className="et-set-inline-foot">
            <SubmitButton className="et-btn et-btn-danger" pendingLabel="Deleting…">
              Delete my account
            </SubmitButton>
          </div>
        </ActionForm>
      </SetRow>
    </>
  );
}
