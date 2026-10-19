import { requireAdmin } from "@/lib/admin";
import { AdminSettingsTabs } from "./AdminSettingsTabs";

// Breadcrumb, title, and pill tabs, same pattern as the learner Settings.
export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin("settings");
  return (
    <div className="et-page">
      <div className="et-tab-head">
        <AdminSettingsTabs showAppearance={admin.isSuper} />
      </div>
      {children}
    </div>
  );
}
