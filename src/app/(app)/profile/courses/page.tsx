import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProfileCourses } from "@/components/dash/ProfileView";
import { getCurrentUser } from "@/lib/auth";
import { getLearnerProfile } from "@/lib/data/profile";

export const metadata = { title: "My courses" };

export default function ProfileCoursesPage() {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
      <Courses />
    </Suspense>
  );
}

async function Courses() {
  const user = await getCurrentUser();
  const data = await getLearnerProfile(user.id);
  if (!data) notFound();
  return (
    <ProfileCourses data={data} courseHref={(id) => `/learn/course/${id}`} />
  );
}
