import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProfileActivity } from "@/components/dash/ProfileView";
import { getCurrentUser } from "@/lib/auth";
import { getLearnerProfile } from "@/lib/data/profile";

export const metadata = { title: "Activity" };

export default function ProfileActivityPage() {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
      <Activity />
    </Suspense>
  );
}

async function Activity() {
  const user = await getCurrentUser();
  const data = await getLearnerProfile(user.id);
  if (!data) notFound();
  return (
    <ProfileActivity data={data} />
  );
}
