import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { WelcomeHero } from "@/components/dash/WelcomeHero";
import { HeroBackgroundEditor } from "../HeroBackgroundEditor";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { saveAnnouncement } from "../actions";

export const metadata = { title: "Appearance" };

export default async function AppearanceSettings() {
  const { admin, db } = await requireAdmin("settings");
  if (!admin.isSuper) redirect("/admin/settings");
  const { data: settings } = await db.from("platform_settings").select("hero_bg_url, announcement_text, announcement_link, announcement_active").single();

  return (
    <>
      <section className="et-card">
        <div className="et-card-head">
          <h2>Announcement bar</h2>
          <span className="et-muted" style={{ fontSize: 12.5 }}>
            A short message at the top of every learner&apos;s dashboard
          </span>
        </div>
        <ActionForm action={saveAnnouncement} toast className="et-card-pad et-form">
          <div className="et-form-grid">
            <div className="et-field et-field-wide">
              <label htmlFor="announcement_text">Message</label>
              <input
                id="announcement_text"
                name="announcement_text"
                defaultValue={settings?.announcement_text ?? ""}
                maxLength={200}
                placeholder="New: Product Design Foundations is live. Enroll for free this week."
              />
            </div>
            <div className="et-field">
              <label htmlFor="announcement_link">
                Link <span className="et-muted">(optional)</span>
              </label>
              <input
                id="announcement_link"
                name="announcement_link"
                defaultValue={settings?.announcement_link ?? ""}
                placeholder="/learn/browse or https://…"
              />
            </div>
            <label className="et-set-box et-set-box-row" style={{ cursor: "pointer", alignSelf: "end" }}>
              <span>
                <b>Show to learners</b>
                <small>Turn off to hide it without deleting.</small>
              </span>
              <input type="checkbox" role="switch" className="et-toggle" name="announcement_active" defaultChecked={settings?.announcement_active ?? false} />
            </label>
          </div>
          <div className="et-form-foot">
            <SubmitButton>Save announcement</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="et-card">
        <div className="et-card-head">
          <h2>Dashboard banner</h2>
          <span className="et-muted" style={{ fontSize: 12.5 }}>
            The &quot;Hello, name&quot; banner at the top of every learner&apos;s dashboard
          </span>
        </div>
        <div className="et-card-pad et-hero-admin">
          <div>
            <p className="et-section-label">Preview</p>
            <WelcomeHero
              name="Ada"
              date="Monday, 19 October 2026"
              message="You're 40% through Product Design Foundations. Keep going to reach your goal."
              cta={{
                label: "Continue learning",
                href: "/admin/settings/appearance",
              }}
              background={settings?.hero_bg_url}
            />
          </div>
          <HeroBackgroundEditor current={settings?.hero_bg_url ?? null} />
        </div>
      </section>
    </>
  );
}
