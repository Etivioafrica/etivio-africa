import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CourseView } from "@/components/market/CourseView";
import { getCourseDetails } from "@/lib/data/learn";

export const metadata = { title: "Course details" };

type Props = { params: Promise<{ id: string }> };

export default function CourseDetails({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Details params={params} />
      </Suspense>
    </div>
  );
}

async function Details({ params }: Props) {
  const { id } = await params;
  const data = await getCourseDetails(id);
  if (!data) notFound();
  await connection();
  return <CourseView data={data} />;
}
