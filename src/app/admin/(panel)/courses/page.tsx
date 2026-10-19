import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { getAdminCourses } from "@/lib/data/courses-admin";
import { CourseList } from "./CourseList";

export const metadata = { title: "Courses" };

export default function AdminCourses() {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  await requireAdmin("courses");
  return <CourseList {...await getAdminCourses()} />;
}
