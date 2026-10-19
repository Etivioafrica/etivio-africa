import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { loadReviews } from "@/lib/data/courses-admin";
import { ReviewsClient } from "./ReviewsClient";

export const metadata = { title: "Course reviews" };

type Props = { searchParams: Promise<{ filter?: string }> };

export default function CourseReviews({ searchParams }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: Props) {
  await requireAdmin("courses");
  const { filter } = await searchParams;
  const reviews = await loadReviews();
  return (
    <>
      <div className="et-page-head">
        <div>
          <h1>Reviews</h1>
          <p>Learners can review a course once they&apos;re 30% through it. Reviews stay hidden until you approve them.</p>
        </div>
      </div>
      <ReviewsClient reviews={reviews} initialFilter={filter === "pending" || filter === "approved" ? filter : "all"} />
    </>
  );
}
