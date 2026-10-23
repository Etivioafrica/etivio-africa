import { Suspense } from "react";
import { AvatarEditor } from "@/components/dash/AvatarEditor";
import { CoverEditor } from "@/components/dash/CoverEditor";
import { getCurrentUser } from "@/lib/auth";
import { getProfileDetails } from "@/lib/data/profile";
import { primaryRole, ROLE_LABELS } from "@/lib/roles";
import { SettingsHeader, SettingsTabs } from "./SettingsTabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const details = await getProfileDetails(user.id);
  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <div className="et-page">
      <section className="et-card et-set">
        <CoverEditor url={details?.coverUrl ?? null} />
        <div className="et-set-id">
          <AvatarEditor variant="banner" url={user.avatarUrl} initial={initial} seed={user.name || user.email} />
          <div className="et-set-name">
            <h2>
              {user.name || "Your account"}
              {user.roles.some((r) => r !== "student") && <span className="et-tag">{ROLE_LABELS[primaryRole(user.roles)]}</span>}
            </h2>
            <p>{user.email}</p>
          </div>
          <SettingsHeader profileHref={details?.username && details.profilePublic ? `/@${details.username}` : "/profile"} />
        </div>

        <div className="et-set-head">
          <SettingsTabs />
        </div>

        <div className="et-set-body">
          <Suspense fallback={<div className="et-skel" style={{ height: 240, margin: "24px 0" }} />}>{children}</Suspense>
        </div>
      </section>
    </div>
  );
}
