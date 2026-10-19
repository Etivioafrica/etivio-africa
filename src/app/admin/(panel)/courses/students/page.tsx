import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { getStudentProgress } from "@/lib/data/courses-admin";
import { StudentsTable } from "./StudentsTable";

export const metadata = { title: "Course students" };

type Props = { searchParams: Promise<{ course?: string }> };

export default function CourseStudents({ searchParams }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: Props) {
  const { db } = await requireAdmin("courses");
  const { course } = await searchParams;
  const [rows, { data: courses }] = await Promise.all([getStudentProgress(), db.from("courses").select("id, title").order("title")]);
  return (
    <>
      <div className="et-page-head">
        <div>
          <h1>Students</h1>
          <p>Everyone enrolled in a course, with their progress. Progress counts lessons and quizzes.</p>
        </div>
      </div>
      <StudentsTable rows={rows} courses={courses ?? []} initialCourse={course ?? "all"} />
    </>
  );
}
