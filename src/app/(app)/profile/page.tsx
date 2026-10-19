import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProfileOverview } from "@/components/dash/ProfileView";
import { getCurrentUser } from "@/lib/auth";
import { getLearnerProfile } from "@/lib/data/profile";

export const metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const user = await getCurrentUser();
  const data = await getLearnerProfile(user.id);
  if (!data) notFound();
  return (
    <ProfileOverview data={data} courseHref={(id) => `/learn/course/${id}`} />
  );
}
