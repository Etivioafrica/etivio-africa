import { Suspense } from "react";
import { getPublicBlog } from "@/lib/data/blog";
import { BlogIndex } from "./BlogIndex";

export const metadata = {
  title: "Blog | Etivio",
  description: "Guides, stories and career advice from Etivio, plus the best reads from around the web.",
};

export default function BlogPage() {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const data = await getPublicBlog();
  // The grid only needs a read time, not whole articles.
  const posts = data.posts.map(({ content, ...p }) => ({ ...p, words: (content ?? "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length }));
  return <BlogIndex posts={posts} categories={data.categories} postCats={data.postCats} curated={data.curated} />;
}
