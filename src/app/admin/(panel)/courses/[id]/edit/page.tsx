import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getCourseCategories } from "@/lib/data/courses-admin";
import { getInstructorOptions } from "../../instructors";
import { CourseWizard } from "../../new/CourseWizard";
import { loadWizardCourse } from "../../wizard-data";

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
  const { admin, db } = await requireAdmin("courses");
  const [loaded, instructors, categories] = await Promise.all([loadWizardCourse(id), getInstructorOptions(db), getCourseCategories()]);
  if (!loaded) notFound();
  const { course, initial, students } = loaded;
  // Keep the current instructor selectable even if they're no longer a tutor.
  const options = instructors.some((i) => i.id === course.instructor_id) ? instructors : [{ id: course.instructor_id, label: course.instructor?.full_name || "Current instructor" }, ...instructors];

  return <CourseWizard key={course.id} instructors={options} categories={categories} defaultInstructor={admin.id} edit={{ courseId: course.id, status: course.status, students }} initial={initial} />;
}
