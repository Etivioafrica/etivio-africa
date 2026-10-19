import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { saveLearningSettings } from "../actions";

export const metadata = { title: "Learning settings" };

export default async function LearningSettings() {
  const { admin, db } = await requireAdmin("settings");
  if (!admin.isSuper) redirect("/admin/settings");
  const { data: s } = await db.from("platform_settings").select("tutor_applications_open, certificate_signer_name, certificate_signer_title").single();

  return (
    <ActionForm action={saveLearningSettings} toast className="et-page">
      <section className="et-card">
        <div className="et-card-head">
          <h2>Tutors</h2>
        </div>
        <label className="et-set-box-row" style={{ cursor: "pointer" }}>
          <span>
            <b>Accept tutor applications</b>
            <small>When off, the Teach on Etivio page says applications are closed and new ones can&apos;t be sent.</small>
          </span>
          <input type="checkbox" role="switch" className="et-toggle" name="tutor_applications_open" defaultChecked={s?.tutor_applications_open ?? true} />
        </label>
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Certificates</h2>
          <span className="et-muted" style={{ fontSize: 12.5 }}>
            Signature on certificates for courses without a tutor
          </span>
        </div>
        <div className="et-card-pad et-form-grid">
          <div className="et-field">
            <label htmlFor="certificate_signer_name">Signed by</label>
            <input id="certificate_signer_name" name="certificate_signer_name" defaultValue={s?.certificate_signer_name ?? ""} placeholder="The Etivio team" maxLength={80} />
          </div>
          <div className="et-field">
            <label htmlFor="certificate_signer_title">Title</label>
            <input id="certificate_signer_title" name="certificate_signer_title" defaultValue={s?.certificate_signer_title ?? ""} placeholder="Etivio Africa" maxLength={80} />
          </div>
          <small className="et-field-wide et-muted" style={{ fontSize: 12 }}>
            Courses with a tutor are signed by the tutor. Leave these empty to use &quot;The Etivio team, Etivio Africa&quot;.
          </small>
        </div>
      </section>

      <div className="et-form-foot">
        <SubmitButton>Save learning settings</SubmitButton>
      </div>
    </ActionForm>
  );
}
