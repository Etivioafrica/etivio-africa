import { Suspense } from "react";
import { JsonLd, breadcrumbs, course as seoCourse } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CourseView } from "@/components/market/CourseView";
import { getCourseDetails } from "@/lib/data/learn";
import { itemMeta } from "@/lib/data/marketplace";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = await itemMeta("course", slug);
  if (!meta) return { title: "Course not found | Etivio", robots: { index: false } };
  const description = meta.summary || `Learn ${meta.title} on Etivio, with a certificate when you finish.`;
  return {
    title: `${meta.title} | Etivio`,
    description,
    alternates: { canonical: `/courses/${slug}` },
    openGraph: { type: "website", siteName: "Etivio", title: meta.title, description, images: meta.cover ? [meta.cover] : undefined },
    twitter: { card: meta.cover ? "summary_large_image" : "summary", title: meta.title, description },
  };
}

// Public course page: anyone can see it, so shared links and search engines land on the real course.
export default function PublicCourse({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 640 }} />}>
      <Course params={params} />
    </Suspense>
  );
}

async function Course({ params }: Props) {
  const data = await getCourseDetails((await params).slug);
  if (!data) notFound();
  await connection();
  const { course: c, instructor, stats } = data;
  return (
    <>
      <JsonLd
        data={[
          seoCourse({ ...c, instructor: instructor.name, seconds: stats.seconds, rating: stats.rating, reviews: stats.reviews }),
          breadcrumbs([
            { name: "Explore", path: "/explore" },
            { name: "Courses", path: "/explore?type=course" },
            { name: c.title, path: `/courses/${c.slug}` },
          ]),
        ]}
      />
      <CourseView data={data} />
    </>
  );
}
