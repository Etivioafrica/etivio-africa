import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { loadProductReviews } from "@/lib/data/products-admin";
import { ReviewsClient } from "../../courses/reviews/ReviewsClient";

export const metadata = { title: "Product reviews" };

type Props = { searchParams: Promise<{ filter?: string }> };

export default function ProductReviews({ searchParams }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: Props) {
  await requireAdmin("marketplace");
  const { filter } = await searchParams;
  const reviews = await loadProductReviews();
  return (
    <>
      <div className="et-page-head">
        <div>
          <h1>Product reviews</h1>
          <p>People who own a template, e-book, resource pack or bundle can review it. Reviews stay hidden until you approve them.</p>
        </div>
      </div>
      <ReviewsClient kind="product" reviews={reviews} initialFilter={filter === "pending" || filter === "approved" ? filter : "all"} />
    </>
  );
}
