import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { savePlatformSettings } from "../actions";

export const metadata = { title: "Platform settings" };

const SOCIALS = [
  { key: "social_x", label: "X (Twitter)", placeholder: "x.com/etivio" },
  { key: "social_instagram", label: "Instagram", placeholder: "instagram.com/etivio" },
  { key: "social_linkedin", label: "LinkedIn", placeholder: "linkedin.com/company/etivio" },
  { key: "social_youtube", label: "YouTube", placeholder: "youtube.com/@etivio" },
  { key: "social_tiktok", label: "TikTok", placeholder: "tiktok.com/@etivio" },
] as const;

export default async function PlatformSettings() {
  const { admin, db } = await requireAdmin("settings");
  const { data: s } = await db.from("platform_settings").select("*").single();

  if (!admin.isSuper)
    return (
      <section className="et-card">
        <div className="et-card-head">
          <h2>Platform</h2>
        </div>
        <dl className="et-kv et-card-pad">
          <dt>Commission</dt>
          <dd>{Number(s?.commission_percent ?? 20)}%</dd>
          <dt>Support email</dt>
          <dd>{s?.support_email || "Not set"}</dd>
          <dt>WhatsApp</dt>
          <dd>{s?.support_whatsapp || "Not set"}</dd>
        </dl>
      </section>
    );

  return (
    <ActionForm action={savePlatformSettings} toast className="et-page">
      <section className="et-card">
        <div className="et-card-head">
          <h2>Money</h2>
        </div>
        <div className="et-card-pad et-form">
          <div className="et-field" style={{ maxWidth: 320 }}>
            <label htmlFor="commission_percent">Platform commission (%)</label>
            <input id="commission_percent" name="commission_percent" type="number" min={0} max={100} step="0.5" defaultValue={Number(s?.commission_percent ?? 20)} />
            <small>Etivio&apos;s share of each course sale. The rest goes to the tutor. Changes apply to future sales only.</small>
          </div>
        </div>
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Support contact</h2>
          <span className="et-muted" style={{ fontSize: 12.5 }}>
            Shown to learners who need help
          </span>
        </div>
        <div className="et-card-pad et-form-grid">
          <div className="et-field">
            <label htmlFor="support_email">Support email</label>
            <input id="support_email" name="support_email" type="email" defaultValue={s?.support_email ?? ""} placeholder="support@etivio.co" />
          </div>
          <div className="et-field">
            <label htmlFor="support_whatsapp">WhatsApp number</label>
            <input id="support_whatsapp" name="support_whatsapp" defaultValue={s?.support_whatsapp ?? ""} placeholder="+234 801 234 5678" inputMode="tel" />
            <small>Adds a &quot;Chat on WhatsApp&quot; link to the site footer.</small>
          </div>
        </div>
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Social links</h2>
          <span className="et-muted" style={{ fontSize: 12.5 }}>
            Shown in the footer of public pages. Leave empty to hide.
          </span>
        </div>
        <div className="et-card-pad et-form-grid">
          {SOCIALS.map((x) => (
            <div key={x.key} className="et-field">
              <label htmlFor={x.key}>{x.label}</label>
              <input id={x.key} name={x.key} defaultValue={s?.[x.key] ?? ""} placeholder={x.placeholder} inputMode="url" />
            </div>
          ))}
        </div>
      </section>

      <div className="et-form-foot">
        <SubmitButton>Save platform settings</SubmitButton>
      </div>
    </ActionForm>
  );
}
