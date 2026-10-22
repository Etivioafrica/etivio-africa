import { Suspense } from "react";
import { JsonLd, blogPosting, breadcrumbs } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, GraduationCap } from "lucide-react";
import { getPublicPost } from "@/lib/data/blog";
import { fmtLong, fmtShort, plainText, readMinutes, toHtml } from "@/lib/blog";
import { sanitizeRichText } from "@/lib/sanitize";
import { PostComments, PostLike, ViewTracker } from "./Reader";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicPost((await params).slug);
  if (!data) return { title: "Post not found | Etivio", robots: { index: false } };
  const { post } = data;
  const title = post.meta_title || post.title;
  const description = post.meta_description || post.excerpt || plainText(post.content).slice(0, 160);
  return {
    title: `${title} | Etivio blog`,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", siteName: "Etivio", title, description, publishedTime: post.published_at ?? undefined, images: post.cover_url ? [post.cover_url] : undefined },
    twitter: { card: post.cover_url ? "summary_large_image" : "summary", title, description },
  };
}

export default function PostPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 640 }} />}>
      <Post params={params} />
    </Suspense>
  );
}

async function Post({ params }: Props) {
  const data = await getPublicPost((await params).slug);
  if (!data) notFound();
  const { post, latest, categories, comments, likes } = data;
  const html = sanitizeRichText(toHtml(post.content));

  return (
    <div className="et-pp">
      <JsonLd
        data={[
          blogPosting({
            slug: post.slug,
            title: post.meta_title || post.title,
            description: post.meta_description || post.excerpt || plainText(post.content).slice(0, 160),
            coverUrl: post.cover_url,
            publishedAt: post.published_at,
            updatedAt: post.updated_at,
            author: post.author?.full_name ?? null,
          }),
          breadcrumbs([
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ]}
      />
      <article className="et-pp-main">
        <ViewTracker postId={post.id} />
        <Link href="/blog" className="et-pp-back">
          <ArrowLeft size={14} /> All posts
        </Link>
        <p className="et-pp-meta">
          {fmtLong(post.published_at)} · {readMinutes(post.content)} min read
          {post.author?.full_name && <> · By {post.author.full_name}</>}
        </p>
        <h1>{post.title}</h1>
        {categories.length > 0 && (
          <p className="et-pp-cats">
            {categories.map((c) => (
              <span key={c.slug} className="et-tag">
                {c.name}
              </span>
            ))}
          </p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {post.cover_url && <img src={post.cover_url} alt="" className="et-pp-cover" />}
        <div className="et-rich et-pp-body" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="et-pp-like">
          <PostLike postId={post.id} initialCount={likes} />
          <span>Found this helpful? Give it a like.</span>
        </div>
        <PostComments postId={post.id} comments={comments} />
      </article>

      <aside className="et-pp-side">
        <div>
          {latest.length > 0 && (
            <section>
              <h3>Latest posts</h3>
              <ul className="et-pp-latest">
                {latest.map((p) => (
                  <li key={p.id}>
                    <Link href={`/blog/${p.slug}`}>
                      <span className="et-pb-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.cover_url && <img src={p.cover_url} alt="" />}
                      </span>
                      <span>
                        <small>{fmtShort(p.published_at)}</small>
                        <b>{p.title}</b>
                        <em>Read more</em>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="et-pp-cta">
            <span className="et-cta-icon">
              <GraduationCap size={20} />
            </span>
            <b>Learn with Etivio</b>
            <p>Practical courses from instructors across Africa. Learn at your pace and earn certificates you can share.</p>
            <Link href="/signup" className="et-btn et-btn-primary">
              Get started free <ArrowRight size={14} />
            </Link>
          </section>
        </div>
      </aside>
    </div>
  );
}
