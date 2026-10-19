import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { getAdminBlog } from "@/lib/data/blog";
import { liveStatus } from "@/lib/blog";
import { MetricsClient } from "./MetricsClient";

export const metadata = { title: "Post metrics" };

export default function BlogMetrics() {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  await requireAdmin("blog");
  const { posts, metrics } = await getAdminBlog();
  const rows = posts.map((p) => ({
    id: p.id,
    title: p.title,
    cover: p.cover_url,
    live: liveStatus(p),
    date: p.published_at,
    views: metrics[p.id]?.views ?? 0,
    likes: metrics[p.id]?.likes ?? 0,
    comments: metrics[p.id]?.comments ?? 0,
    pending: metrics[p.id]?.pending ?? 0,
    avgRead: metrics[p.id]?.avgRead ?? null,
  }));
  return <MetricsClient rows={rows} />;
}
