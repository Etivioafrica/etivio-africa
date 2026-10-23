import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { getCourseCategories } from "@/lib/data/courses-admin";
import { getInstructorOptions } from "../instructors";
import { CourseWizard } from "./CourseWizard";
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

async function Content() {
  const { admin, db } = await requireAdmin("courses");
  const [instructors, categories] = await Promise.all([getInstructorOptions(db), getCourseCategories()]);
  return <CourseWizard ai={await featureOn("ai_course_tools")} instructors={instructors} categories={categories} defaultInstructor={admin.id} />;
}
