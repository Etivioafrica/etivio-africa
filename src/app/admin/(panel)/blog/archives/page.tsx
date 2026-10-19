import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { liveStatus, type PostStatus } from "@/lib/blog";
import { ArchivesClient } from "./ArchivesClient";

export const metadata = { title: "Blog archives" };

export default function BlogArchives() {
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
  const { data } = await db.from("blog_posts").select("id, title, slug, excerpt, status, published_at, created_at").order("created_at", { ascending: false });
  const posts = (data ?? []).map((p) => ({ ...p, live: liveStatus({ status: p.status as PostStatus, published_at: p.published_at }) }));
  return <ArchivesClient posts={posts} />;
}
