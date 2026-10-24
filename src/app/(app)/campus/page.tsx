import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, Hash, MessagesSquare, Newspaper, TrendingUp, Users, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { getCurrentUser } from "@/lib/auth";
import { featureOn } from "@/lib/data/features";
import { isStaff } from "@/lib/roles";
import { CAMPUS_KINDS, campusFeed, campusOn, campusSidebar, type CampusKind, type CampusSort, type FeedQuery } from "@/lib/data/campus";
import { Composer, FeedList, NewPosts } from "./CampusFeed";
import "./campus.css";

export const metadata = { title: "Campus" };

type Props = { searchParams: Promise<{ kind?: string; sort?: string; tag?: string; saved?: string }> };

const SORTS: { value: CampusSort; label: string }[] = [
  { value: "latest", label: "Latest" },
  { value: "hot", label: "Hot" },
  { value: "top", label: "Top" },
];

export default function CampusPage({ searchParams }: Props) {
  return (
    <div className="et-page et-cps">
      <Suspense fallback={<div className="et-skel" style={{ height: 620 }} />}>
        <Campus searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Campus({ searchParams }: Props) {
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (!(await campusOn())) redirect("/learn");
  const kind = CAMPUS_KINDS.find((k) => k.value === sp.kind)?.value as CampusKind | undefined;
  const sort = SORTS.find((s) => s.value === sp.sort)?.value ?? "latest";
  const tag = sp.tag?.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30) || undefined;
  const saved = sp.saved === "1";
  const query: FeedQuery = { kind, tag, sort, saved };
  const viewer = { id: user.id, staff: isStaff(user.roles), name: user.name || user.email, avatar: user.avatarUrl };
  const [{ posts, more }, side, communities] = await Promise.all([campusFeed(viewer, query), campusSidebar(), featureOn("communities")]);

  // Filter links keep the other filters.
  const href = (next: Partial<{ kind: string; sort: string; tag: string; saved: string }>) => {
    const p = new URLSearchParams();
    const merged = { kind: kind ?? "", sort: sort === "latest" ? "" : sort, tag: tag ?? "", saved: saved ? "1" : "", ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/campus?${qs}` : "/campus";
  };

  return (
    <>
      <div className="et-page-head et-cps-head">
        <div>
          <h1>Campus</h1>
          <p>Where Etivio learners share what they&apos;re learning, ask questions and celebrate wins.</p>
        </div>
        <div className="et-cps-members">
          <span className="et-cps-faces">
            {side.faces.map((f, i) => (
              <Avatar key={i} src={f.avatar} initial={(f.name || "E").charAt(0).toUpperCase()} seed={f.name} className="et-cps-face is-xs" />
            ))}
          </span>
          <small>
            <Users size={13} /> {side.members.toLocaleString()} learners
          </small>
        </div>
      </div>

      <div className="et-cps-filters">
        <nav className="et-seg" aria-label="Post type">
          <Link href={href({ kind: "", saved: "" })} className={!kind && !saved ? "is-on" : ""}>
            All
          </Link>
          {CAMPUS_KINDS.map((k) => (
            <Link key={k.value} href={href({ kind: k.value, saved: "" })} className={kind === k.value ? "is-on" : ""}>
              {k.plural}
            </Link>
          ))}
          <Link href={href({ kind: "", saved: "1", tag: "" })} className={saved ? "is-on" : ""}>
            Saved
          </Link>
        </nav>
        {!saved && (
          <nav className="et-seg et-cps-sort" aria-label="Sort">
            {SORTS.map((s) => (
              <Link key={s.value} href={href({ sort: s.value === "latest" ? "" : s.value })} className={sort === s.value ? "is-on" : ""}>
                {s.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <div className="et-cps-layout">
        <div className="et-cps-feed">
          {tag && (
            <Link href={href({ tag: "" })} className="et-cps-tagchip">
              <Hash size={13} />
              {tag}
              <X size={13} />
            </Link>
          )}
          {!saved && <Composer viewer={viewer} />}
          <NewPosts viewerId={user.id} />
          <FeedList
            key={JSON.stringify(query)}
            initial={posts}
            more={more}
            viewer={viewer}
            query={query}
            empty={
              <div className="et-card et-cp-empty">
                <span>{saved ? <Bookmark size={20} /> : <MessagesSquare size={20} />}</span>
                <b>{saved ? "No saved posts yet" : tag ? `No posts with #${tag} yet` : kind ? `No ${CAMPUS_KINDS.find((k) => k.value === kind)?.plural.toLowerCase()} yet` : "Campus is quiet"}</b>
                <p>{saved ? "Tap the bookmark on any post to keep it here." : "Be the first to post something."}</p>
              </div>
            }
          />
        </div>

        <aside className="et-cps-side">
          {side.trending.length > 0 && (
            <section className="et-card et-card-pad">
              <h2 className="et-cps-side-title">
                <TrendingUp size={15} /> Trending this week
              </h2>
              <ul className="et-cps-trending">
                {side.trending.map((t) => (
                  <li key={t.tag}>
                    <Link href={`/campus?tag=${t.tag}`}>
                      <b>#{t.tag}</b>
                      <small>
                        {t.posts} {t.posts === 1 ? "post" : "posts"}
                      </small>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {side.blog.length > 0 && (
            <section className="et-card et-card-pad">
              <h2 className="et-cps-side-title">
                <Newspaper size={15} /> From Etivio
              </h2>
              <ul className="et-cps-blog">
                {side.blog.map((b) => (
                  <li key={b.slug}>
                    <Link href={`/blog/${b.slug}`}>{b.title}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {communities && (
            <Link href="/communities" className="et-card et-card-pad et-cps-side-link">
              <Users size={16} />
              <span>
                <b>Communities</b>
                <small>Smaller spaces for a course or topic</small>
              </span>
            </Link>
          )}
          <section className="et-card et-card-pad et-cps-rules">
            <h2 className="et-cps-side-title">Campus rules</h2>
            <p>Be kind, stay on learning and work, and keep it clean. No sexual content, harassment or spam: posts that break the rules are removed and can lead to a ban.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
