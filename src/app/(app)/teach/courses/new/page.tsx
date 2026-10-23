import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canTeach } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourseCategories } from "@/lib/data/courses-admin";
import { CourseWizard } from "@/app/admin/(panel)/courses/new/CourseWizard";
import { featureOn } from "@/lib/data/features";

export const metadata = { title: "New course" };

export default function NewCourse() {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Content />
      </Suspense>
    </div>
  );
}

// Tutors use the same four-step wizard as admins (with the AI tools); they're the instructor, and the course is
// submitted for review instead of published.
async function Content() {
  const user = await getCurrentUser();
  if (!canTeach(user.roles)) redirect("/teach");
  const [{ data: profile }, categories] = await Promise.all([createAdminClient().from("profiles").select("full_name, trusted_tutor").eq("id", user.id).maybeSingle(), getCourseCategories()]);
  return (
    <CourseWizard
      ai={await featureOn("ai_course_tools")}
      instructors={[{ id: user.id, label: profile?.full_name || user.name || "You" }]}
      categories={categories}
      defaultInstructor={user.id}
      tutor={{ canPublish: !!profile?.trusted_tutor || user.roles.includes("super_admin") }}
    />
  );
}
