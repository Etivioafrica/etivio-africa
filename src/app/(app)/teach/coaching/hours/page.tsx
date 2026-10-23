import Link from "next/link";
import { PageHead } from "@/components/dash/ui";
import { DaysOff, HoursEditor } from "@/components/coaching/CoachEditor";
import { getCurrentUser } from "@/lib/auth";
import { myCoachProfile } from "@/lib/data/coaching";

export const metadata = { title: "Coaching hours" };

export default async function HoursPage() {
  const user = await getCurrentUser();
  const { profile, hours, daysOff } = await myCoachProfile(user.id);
  if (!profile)
    return (
      <div className="et-page">
        <PageHead title="Hours" sub="When learners can book you." />
        <section className="et-card et-card-pad et-cb-setup">
          <p className="et-muted">Set up your coach profile first.</p>
          <Link href="/teach/coaching/profile" className="et-btn et-btn-primary">
            Set up profile
          </Link>
        </section>
      </div>
    );
  return (
    <div className="et-page">
      <PageHead title="Hours" sub={`When learners can book you, in your time zone (${profile.timezone.replace("_", " ")}).`} />
      <section className="et-card et-card-pad">
        <h2 className="et-cb-h2">Weekly hours</h2>
        <p className="et-cb-muted">Sessions are {profile.session_minutes} minutes, so each range is split into {profile.session_minutes}-minute slots.</p>
        <HoursEditor hours={hours} />
      </section>
      <section className="et-card et-card-pad">
        <h2 className="et-cb-h2">Days off</h2>
        <p className="et-cb-muted">No bookings on these dates. Sessions already booked stay booked.</p>
        <DaysOff days={daysOff} />
      </section>
    </div>
  );
}
