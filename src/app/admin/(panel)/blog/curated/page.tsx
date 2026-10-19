import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { CuratedClient } from "./CuratedClient";

export const metadata = { title: "Curated links" };

export default function BlogCurated() {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const { db } = await requireAdmin("blog");
  const { data } = await db.from("blog_curated").select("*").order("created_at", { ascending: false });
  return <CuratedClient links={data ?? []} />;
}
