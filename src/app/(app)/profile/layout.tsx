import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, PenLine } from "lucide-react";
import { CopyLink } from "@/components/dash/CopyLink";
import { ProfileHero, profileBadges } from "@/components/dash/ProfileView";
import { getCurrentUser } from "@/lib/auth";
import { getLearnerProfile } from "@/lib/data/profile";
import { syncBadges } from "@/lib/data/badges";
import { syncCertificates } from "@/lib/data/certificates";
import { ProfileTabs } from "./ProfileTabs";

// Your profile: hero on top, then Overview / Badges tabs (same pattern as Settings).
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
        <Header />
      </Suspense>
      <div className="et-tab-head">
        <ProfileTabs />
      </div>
      {children}
    </div>
  );
}

async function Header() {
  const user = await getCurrentUser();
  const data = await getLearnerProfile(user.id);
  if (!data) notFound();
  await Promise.all([syncBadges(user.id), syncCertificates(user.id)]);
  const { profile } = data;

  return (
    <ProfileHero
      profile={profile}
      badges={profileBadges(data, true)}
      skills={data.skills}
      actions={
        <>
          {profile.username && profile.profilePublic ? (
            <>
              <CopyLink path={`/@${profile.username}`} />
              <Link href={`/@${profile.username}`} className="et-btn et-btn-ghost">
                <ExternalLink size={15} />
                Public page
              </Link>
            </>
          ) : (
            <Link href="/settings" className="et-btn et-btn-ghost">
              Claim your username
            </Link>
          )}
          <Link href="/settings" className="et-btn et-btn-primary">
            <PenLine size={15} />
            Edit profile
          </Link>
        </>
      }
    />
  );
}
