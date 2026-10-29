import { Suspense } from "react";
import { Heart } from "lucide-react";
import { CourseGrid } from "@/components/dash/CourseGrid";
import { EmptyMini, PageHead } from "@/components/dash/ui";
import { getMyCourses, getSavedCourses } from "@/lib/data/learn";

export const metadata = { title: "Saved courses" };

// Courses the learner has hearted, kept until they're ready to start.
export default function SavedPage() {
  return (
    <div className="et-page">
      <PageHead title="Saved" sub="Courses you've saved for later." />
      <Suspense fallback={<div className="et-skel" style={{ height: 240 }} />}>
        <Saved />
      </Suspense>
    </div>
  );
}

async function Saved() {
  const [saved, mine] = await Promise.all([getSavedCourses(), getMyCourses()]);
  if (!saved.length)
    return (
      <section className="et-card">
        <EmptyMini icon={Heart} title="Nothing saved yet" action={{ href: "/learn/browse", label: "Browse courses" }}>
          Tap the heart on any course to save it for later.
        </EmptyMini>
      </section>
    );
  return <CourseGrid courses={saved} enrolledIds={new Set(mine.map((c) => c.id))} savedIds={new Set(saved.map((c) => c.id))} />;
}
