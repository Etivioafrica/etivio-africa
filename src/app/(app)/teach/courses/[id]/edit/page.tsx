import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourseCategories } from "@/lib/data/courses-admin";
import { CourseWizard } from "@/app/admin/(panel)/courses/new/CourseWizard";
import { loadWizardCourse } from "@/app/admin/(panel)/courses/wizard-data";

export const metadata = { title: "Edit course" };

type Props = { params: Promise<{ id: string }> };

export default function EditCourse({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 560 }} />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");
  const [loaded, { data: profile }, categories] = await Promise.all([loadWizardCourse(id), createAdminClient().from("profiles").select("full_name, trusted_tutor").eq("id", user.id).maybeSingle(), getCourseCategories()]);
  if (!loaded || loaded.course.instructor_id !== user.id) notFound();
  const { course, initial, students } = loaded;
  return (
    <CourseWizard
      key={course.id}
      instructors={[{ id: user.id, label: profile?.full_name || "You" }]}
      categories={categories}
      defaultInstructor={user.id}
      edit={{ courseId: course.id, status: course.status, students }}
      tutor={{ canPublish: !!profile?.trusted_tutor || !!course.published_at }}
      initial={initial}
    />
  );
}
