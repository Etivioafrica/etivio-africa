import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProfileView } from "@/components/dash/ProfileView";
import { getCurrentUser } from "@/lib/auth";
import { getLearnerProfile } from "@/lib/data/profile";
import { canTeach } from "@/lib/roles";

export const metadata = { title: "Student" };

export default function StudentProfile({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="et-page"><div className="et-skel" style={{ height: 320 }} /></div>}>
      <StudentContent params={params} />
    </Suspense>
  );
}

async function StudentContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");

  // RLS limits enrollments + progress to this tutor's own courses, so a learner who
  // isn't in any of them comes back with no courses and is treated as not found.
  const data = await getLearnerProfile(id);
  if (!data || (!data.courses.length && id !== user.id)) notFound();

  return (
    <div className="et-page">
      <Link href="/teach/students" className="et-back">
        <ArrowLeft size={14} />
        All students
      </Link>
      <ProfileView data={data} emptyCourses={null} />
      <p className="et-muted" style={{ fontSize: 12.5 }}>
        You only see this student&apos;s progress in courses you teach.
      </p>
    </div>
  );
}
