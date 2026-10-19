import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { getAdminBlog } from "@/lib/data/blog";
import { BlogList } from "./BlogList";

export const metadata = { title: "Blog" };

export default function AdminBlog() {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Posts />
      </Suspense>
    </div>
  );
}

async function Posts() {
  await requireAdmin("blog");
  const data = await getAdminBlog();
  return <BlogList {...data} />;
}
