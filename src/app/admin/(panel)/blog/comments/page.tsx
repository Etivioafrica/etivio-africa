import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { CommentsClient } from "./CommentsClient";

export const metadata = { title: "Blog comments" };

type Props = { searchParams: Promise<{ filter?: string }> };

export default function BlogComments({ searchParams }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: Props) {
  const { db } = await requireAdmin("blog");
  const { filter } = await searchParams;
  const { data } = await db
    .from("blog_comments")
    .select("id, author_name, author_email, user_id, content, approved, admin_reply, replied_at, created_at, post:blog_posts(title, slug)")
    .order("created_at", { ascending: false })
    .limit(500);
  return <CommentsClient comments={data ?? []} initialFilter={filter === "pending" || filter === "approved" ? filter : "all"} />;
}
