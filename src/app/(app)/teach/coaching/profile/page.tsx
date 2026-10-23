import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHead, Status } from "@/components/dash/ui";
import { CoachProfileForm, StatusControls } from "@/components/coaching/CoachEditor";
import { getCurrentUser } from "@/lib/auth";
import { myCoachProfile } from "@/lib/data/coaching";

export const metadata = { title: "Coach profile" };

const LABEL: Record<string, string> = { draft: "Not published", live: "Live", paused: "Paused", suspended: "Paused by Etivio" };

export default async function CoachProfilePage() {
  const user = await getCurrentUser();
  const { profile, hours } = await myCoachProfile(user.id);
  return (
    <div className="et-page">
      <PageHead title="Coach profile" sub="What learners see on your coach page.">
        {profile && (
          <Link href={`/coaches/${profile.slug}`} className="et-btn et-btn-ghost" target="_blank">
            <ExternalLink size={15} /> Preview
          </Link>
        )}
      </PageHead>
      {profile && (
        <section className="et-card et-card-pad et-cb-publish">
          <div>
            <p className="et-cb-label">Page status</p>
            <Status value={profile.status === "live" ? "published" : profile.status === "suspended" ? "archived" : "draft"} label={LABEL[profile.status]} />
            {!hours.length && (
              <p className="et-cb-muted">
                Add your <Link href="/teach/coaching/hours">weekly hours</Link> before you publish.
              </p>
            )}
          </div>
          <StatusControls status={profile.status} />
        </section>
      )}
      <section className="et-card et-card-pad">
        <CoachProfileForm profile={profile} />
      </section>
    </div>
  );
}
