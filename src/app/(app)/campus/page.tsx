import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bookmark, Briefcase, ChevronDown, Clock, Flame, Hash, HelpCircle, Layers, MapPin, Search, MessagesSquare, Newspaper, PlayCircle, TrendingUp, Users, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { Cover, Progress } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { featureOn } from "@/lib/data/features";
import { listCommunities } from "@/lib/data/communities";
import { isStaff } from "@/lib/roles";
import { getMyCourses } from "@/lib/data/learn";
import { CAMPUS_KINDS, campusFeed, campusOn, campusSideFeeds, campusSidebar, type CampusKind, type CampusSort, type FeedQuery } from "@/lib/data/campus";
import { Composer, FeedList, NewPosts, StarterPrompts } from "./CampusFeed";
import { JoinCommunity, OnlineNow } from "./CampusSide";
import { JOB_PAY, JOB_TYPE } from "./job";
import { KIND_STYLE } from "./kinds";
import "./campus.css";

export const metadata = { title: "Campus" };

type Props = {
  searchParams: Promise<{
    kind?: string;
    sort?: string;
    tag?: string;
    saved?: string;
    q?: string;
  }>;
};

const SORTS: { value: CampusSort; label: string; hint: string }[] = [
  { value: "latest", label: "Latest", hint: "Newest first" },
  { value: "hot", label: "Hot", hint: "Popular right now" },
  { value: "top", label: "Top", hint: "Most liked this month" },
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
  const tag =
    sp.tag
      ?.toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 30) || undefined;
  const saved = sp.saved === "1";
  const search = sp.q?.trim().replace(/\s+/g, " ").slice(0, 80) || undefined;
  const query: FeedQuery = { kind, tag, search, sort, saved };
  const viewer = {
    id: user.id,
    staff: isStaff(user.roles),
    name: user.name || user.email,
    avatar: user.avatarUrl,
  };
  const [{ posts, more }, side, communitiesOn, feeds, mine] = await Promise.all([campusFeed(viewer, query), campusSidebar(), featureOn("communities"), campusSideFeeds(), getMyCourses()]);
  const current = mine.find((c) => !c.completed) ?? null;
  const snippet = (text: string) => (text.length > 90 ? `${text.slice(0, 88).trimEnd()}…` : text);
  // Communities to join (open ones first), or the ones they're in once they've joined them all.
  const groups = communitiesOn ? await listCommunities(user.id) : null;
  const suggested = groups ? [...groups.discover].sort((a, b) => Number(b.joinMode === "open") - Number(a.joinMode === "open") || b.members - a.members).slice(0, 4) : [];
  const joined = groups && !suggested.length ? groups.joined.slice(0, 4) : [];

  // Filter links keep the other filters.
  const href = (
    next: Partial<{
      kind: string;
      sort: string;
      tag: string;
      saved: string;
      q: string;
    }>,
  ) => {
    const p = new URLSearchParams();
    const merged = {
      kind: kind ?? "",
      sort: sort === "latest" ? "" : sort,
      tag: tag ?? "",
      saved: saved ? "1" : "",
      q: search ?? "",
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/campus?${qs}` : "/campus";
  };

  return (
    <>
      <div className="et-page-head et-cps-head">
        <h1>Campus</h1>
        <div className="et-cps-members">
          <span className="et-cps-faces">
            {side.faces.map((f, i) => (
              <Avatar key={i} src={f.avatar} initial={(f.name || "E").charAt(0).toUpperCase()} seed={f.name} className="et-cps-face is-xs" />
            ))}
          </span>
          <small>
            <Users size={13} /> {side.members.toLocaleString()} learners
          </small>
          <OnlineNow viewerId={user.id} />
        </div>
      </div>

      <div className="et-cps-top">
        <div className="et-cps-bar">
          <nav className="et-cps-tabs" aria-label="Post type">
            <Link href={href({ kind: "", saved: "" })} className={!kind && !saved ? "is-on" : ""}>
              <Layers size={15} /> All
            </Link>
            {CAMPUS_KINDS.map((k) => {
              const Icon = KIND_STYLE[k.value].icon;
              return (
                <Link key={k.value} href={href({ kind: k.value, saved: "" })} className={kind === k.value ? "is-on" : ""}>
                  <Icon size={15} /> {k.plural}
                </Link>
              );
            })}
          </nav>
          <details className="et-cps-sortmenu" key={`${sort}-${saved}`}>
            <summary>
              {saved ? <Bookmark size={14} /> : sort === "hot" ? <Flame size={14} /> : sort === "top" ? <TrendingUp size={14} /> : <Clock size={14} />}
              {saved ? "Saved" : SORTS.find((x) => x.value === sort)?.label}
              <ChevronDown size={14} />
            </summary>
            <div role="menu">
              {SORTS.map((x) => (
                <Link
                  key={x.value}
                  role="menuitem"
                  href={href({
                    sort: x.value === "latest" ? "" : x.value,
                    saved: "",
                  })}
                  className={!saved && sort === x.value ? "is-on" : ""}
                >
                  {x.value === "hot" ? <Flame size={15} /> : x.value === "top" ? <TrendingUp size={15} /> : <Clock size={15} />}
                  <span>
                    <b>{x.label}</b>
                    <small>{x.hint}</small>
                  </span>
                </Link>
              ))}
              <Link role="menuitem" href={href({ kind: "", saved: "1", tag: "", sort: "" })} className={saved ? "is-on" : ""}>
                <Bookmark size={15} />
                <span>
                  <b>Saved</b>
                  <small>Posts you bookmarked</small>
                </span>
              </Link>
            </div>
          </details>
        </div>
        <form action="/campus" role="search" className="et-cps-search">
          {kind && <input type="hidden" name="kind" value={kind} />}
          {sort !== "latest" && <input type="hidden" name="sort" value={sort} />}
          {tag && <input type="hidden" name="tag" value={tag} />}
          <Search size={16} />
          <input type="search" name="q" defaultValue={search ?? ""} placeholder="Search Campus" aria-label="Search Campus" maxLength={80} />
        </form>
      </div>

      <div className="et-cps-layout">
        <div className="et-cps-feed">
          {search && (
            <Link href={href({ q: "" })} className="et-cps-tagchip">
              <Search size={13} />
              {search}
              <X size={13} />
            </Link>
          )}
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
              <div className="et-cps-empty">
                <span>{saved ? <Bookmark size={22} /> : <MessagesSquare size={22} />}</span>
                <b>
                  {saved
                    ? "No saved posts yet"
                    : search
                      ? `Nothing matches "${search}"`
                      : tag
                        ? `No posts with #${tag} yet`
                        : kind
                          ? `No ${CAMPUS_KINDS.find((k) => k.value === kind)?.plural.toLowerCase()} yet`
                          : "Say hello to Campus"}
                </b>
                <p>{saved ? "Tap the bookmark on any post to keep it here." : search ? "Try fewer or different words." : "Every learner on Etivio sees what you post here. Start the conversation."}</p>
                {!saved && !search && <StarterPrompts />}
              </div>
            }
          />
        </div>

        <aside className="et-cps-side">
          {current && (
            <section className="et-card et-card-pad et-cps-resume">
              <h2 className="et-cps-side-title">
                <PlayCircle size={15} /> Continue learning
              </h2>
              <Link href={`/learn/course/${current.id}`} className="et-cps-resume-course">
                <Cover url={current.coverUrl} small />
                <span>
                  <b>{current.title}</b>
                  <small>
                    {current.lessonsLeft} {current.lessonsLeft === 1 ? "lesson" : "lessons"} left
                  </small>
                </span>
              </Link>
              <Progress value={current.progress} />
              <Link href={`/learn/course/${current.id}`} className="et-btn et-btn-primary et-btn-sm et-cps-resume-btn">
                {current.done ? "Resume" : "Start course"} <ArrowRight size={14} />
              </Link>
            </section>
          )}
          {feeds.unanswered.length > 0 && (
            <section className="et-card et-card-pad">
              <h2 className="et-cps-side-title">
                <HelpCircle size={15} /> Help someone out
              </h2>
              <ul className="et-cps-asks">
                {feeds.unanswered.map((q) => (
                  <li key={q.id}>
                    <Link href={`/campus/${q.id}`}>
                      <Avatar src={q.author.avatar} initial={(q.author.name || "E").charAt(0).toUpperCase()} seed={q.author.name} className="et-cps-face is-xs" />
                      <span>
                        <b>{snippet(q.body)}</b>
                        <small>{q.author.name || "A learner"} · No answers yet</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={href({ kind: "question", saved: "" })} className="et-cps-side-more">
                See all questions
              </Link>
            </section>
          )}
          {feeds.opportunities.length > 0 && (
            <section className="et-card et-card-pad">
              <h2 className="et-cps-side-title">
                <Briefcase size={15} /> Opportunities
              </h2>
              <ul className="et-cps-opps">
                {feeds.opportunities.map((o) => {
                  const pay = o.job ? JOB_PAY.find((x) => x.value === o.job!.pay) : null;
                  const type = o.job ? JOB_TYPE.find((x) => x.value === o.job!.type)?.label : null;
                  const where = o.job ? (o.job.remote ? "Remote" : o.job.location) : "";
                  return (
                    <li key={o.id}>
                      <Link href={`/campus/${o.id}`}>
                        <b>{o.job?.title || snippet(o.body)}</b>
                        {o.job?.company && <small>{o.job.company}</small>}
                        <span className="et-cps-opp-meta">
                          {pay && <i style={{ background: pay.color }}>{pay.label}</i>}
                          {type && <small>{type}</small>}
                          {where && (
                            <small>
                              <MapPin size={11} /> {where}
                            </small>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link href={href({ kind: "opportunity", saved: "" })} className="et-cps-side-more">
                See all opportunities
              </Link>
            </section>
          )}
          <section className="et-card et-card-pad">
            <h2 className="et-cps-side-title">
              <TrendingUp size={15} /> Trending this week
            </h2>
            {side.trending.length === 0 ? (
              <p className="et-cps-side-empty">No tags yet. Add a #tag to your post and it shows up here.</p>
            ) : (
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
            )}
          </section>
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
          {groups && (
            <section className="et-card et-card-pad">
              <h2 className="et-cps-side-title">
                <Users size={15} /> {suggested.length ? "Communities to join" : "Your communities"}
              </h2>
              <ul className="et-cps-groups">
                {[...suggested, ...joined].map((c) => (
                  <li key={c.id}>
                    <Link href={`/communities/${c.slug}`} className="et-cps-group">
                      {c.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.coverUrl} alt="" />
                      ) : (
                        <span className="et-cps-group-mark">{c.name.charAt(0).toUpperCase()}</span>
                      )}
                      <span>
                        <b>{c.name}</b>
                        <small>
                          {c.members.toLocaleString()} {c.members === 1 ? "member" : "members"}
                          {c.mine?.status === "pending" ? " · Requested" : ""}
                        </small>
                      </span>
                    </Link>
                    {c.joinMode === "open" && !c.mine && <JoinCommunity slug={c.slug} />}
                  </li>
                ))}
              </ul>
              <Link href="/communities" className="et-cps-side-more">
                {suggested.length || joined.length ? "See all communities" : "Find a community"}
              </Link>
            </section>
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
