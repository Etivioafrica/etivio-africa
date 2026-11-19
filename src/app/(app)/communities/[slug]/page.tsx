import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Check, Users, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { CopyLink } from "@/components/dash/CopyLink";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES, JOIN_LABEL, communityFeed, communityMembers, getCommunity, isCategory, pendingRequests } from "@/lib/data/communities";
import { decideRequest, leaveCommunity } from "../actions";
import { Composer, Feed, JoinBox, RulesEditor } from "./CommunityClient";
import { ReportButton } from "@/components/moderation/ReportButton";

export const metadata = { title: "Community" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ invite?: string; type?: string }> };

export default function CommunityPage({ params, searchParams }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Community params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Community({ params, searchParams }: Props) {
  const [{ slug }, { invite, type }, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const c = await getCommunity(slug, user.id, user.roles);
  if (!c) notFound();
  // Invite-only spaces stay hidden from people without the link.
  if (c.joinMode === "invite" && !c.isMember && invite !== c.invite_code) notFound();
  const category = isCategory(type) ? type : undefined;
  const isOwner = c.mine?.role === "owner" || user.roles.includes("super_admin");
  const [feed, requests, members] = await Promise.all([
    c.isMember ? communityFeed(c.id, user.id, c.canModerate, { category }) : Promise.resolve({ posts: [], hasMore: false }),
    c.canModerate ? pendingRequests(c.id) : Promise.resolve([]),
    c.isMember ? communityMembers(c.id, 60) : Promise.resolve([]),
  ]);
  const staffRoles = members.filter((m) => m.role !== "member");
  const recent = members.filter((m) => m.role === "member").slice(0, 8);
  const base = `/communities/${c.slug}`;

  return (
    <>
      <Link href="/communities" className="et-back">
        <ArrowLeft size={14} />
        Communities
      </Link>
      <section className="et-cm-hero" style={c.cover_url ? { backgroundImage: `url(${c.cover_url})` } : undefined}>
        <div>
          <h1>
            {c.name} {c.is_official && <BadgeCheck size={20} aria-label="Official" />}
          </h1>
          {c.description && <p>{c.description}</p>}
          <small>
            <Users size={13} /> {c.members.toLocaleString()} {c.members === 1 ? "member" : "members"} · {c.joinMode === "course" && c.course ? `For students of ${c.course.title}` : JOIN_LABEL[c.joinMode]}
          </small>
          {c.owner_id !== user.id && !c.is_official && <ReportButton type="community" id={c.id} label="Report" />}
        </div>
      </section>

      <div className="et-cm-layout">
        <div className="et-cm-feed">
          {c.isMember ? (
            <>
              <Composer slug={c.slug} />
              <nav className="et-cm-chips" aria-label="Filter posts">
                <Link href={base} className={`et-cm-chip${category ? "" : " is-on"}`} scroll={false}>
                  All
                </Link>
                {CATEGORIES.map((k) => (
                  <Link key={k.id} href={`${base}?type=${k.id}`} className={`et-cm-chip${category === k.id ? " is-on" : ""}`} scroll={false}>
                    {k.label}
                  </Link>
                ))}
              </nav>
              <Feed key={`${category ?? "all"}:${feed.posts.map((p) => p.id).join(",")}`} initial={feed.posts} hasMore={feed.hasMore} slug={c.slug} category={category} canModerate={c.canModerate} viewerId={user.id} />
            </>
          ) : (
            <section className="et-card et-card-pad">
              <h2 className="et-cm-join-title">Join to see posts and take part</h2>
              <JoinBox slug={c.slug} mode={c.joinMode} question={c.join_question} invite={invite ?? ""} pending={c.mine?.status === "pending"} />
            </section>
          )}
        </div>

        <aside className="et-cm-side">
          {c.isMember && (
            <section className="et-card et-card-pad">
              <b className="et-cm-side-title">About</b>
              {c.description && <p className="et-cm-about">{c.description}</p>}
              <small className="et-muted">Started {new Date(c.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</small>
              <b className="et-cm-side-title et-cm-rules-title">Rules</b>
              {c.rules ? <p className="et-cm-about et-cm-rules">{c.rules}</p> : <p className="et-muted" style={{ fontSize: 13, margin: "4px 0 0" }}>No rules set yet.</p>}
              {isOwner && (
                <div style={{ marginTop: 10 }}>
                  <RulesEditor slug={c.slug} rules={c.rules} />
                </div>
              )}
            </section>
          )}
          {c.isMember && members.length > 0 && (
            <section className="et-card">
              <div className="et-card-head">
                <h2>Members ({c.members.toLocaleString()})</h2>
                <Link href={`${base}/members`} className="et-link">
                  See all
                </Link>
              </div>
              <ul className="et-cm-requests">
                {[...staffRoles, ...recent].map((m) => (
                  <li key={m.userId}>
                    <Avatar src={m.avatar} initial={m.name.charAt(0).toUpperCase()} seed={m.name} className="et-cm-face" />
                    <span>
                      <b>{m.name}</b>
                      {m.role !== "member" && <small>{m.role === "owner" ? "Owner" : "Moderator"}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {c.canModerate && requests.length > 0 && (
            <section className="et-card">
              <div className="et-card-head">
                <h2>Requests to join ({requests.length})</h2>
              </div>
              <ul className="et-cm-requests">
                {requests.map((r) => (
                  <li key={r.userId}>
                    <Avatar src={r.avatar} initial={r.name.charAt(0).toUpperCase()} seed={r.name} className="et-cm-face" />
                    <span>
                      <b>{r.name}</b>
                      {r.answer && <small>&ldquo;{r.answer}&rdquo;</small>}
                    </span>
                    <form action={decideRequest}>
                      <input type="hidden" name="slug" value={c.slug} />
                      <input type="hidden" name="user_id" value={r.userId} />
                      <input type="hidden" name="approve" value="1" />
                      <button type="submit" className="et-icon-btn" aria-label={`Approve ${r.name}`}>
                        <Check size={15} />
                      </button>
                    </form>
                    <form action={decideRequest}>
                      <input type="hidden" name="slug" value={c.slug} />
                      <input type="hidden" name="user_id" value={r.userId} />
                      <input type="hidden" name="approve" value="0" />
                      <button type="submit" className="et-icon-btn" aria-label={`Decline ${r.name}`}>
                        <X size={15} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {c.canModerate && c.joinMode === "invite" && (
            <section className="et-card et-card-pad">
              <b className="et-cm-side-title">Invite link</b>
              <p className="et-muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>
                Only people with this link can join.
              </p>
              <CopyLink path={`/communities/${c.slug}?invite=${c.invite_code}`} label="Copy invite link" />
            </section>
          )}
          {c.joinMode !== "invite" && (
            <section className="et-card et-card-pad">
              <b className="et-cm-side-title">Share</b>
              <p className="et-muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>
                Send people the link to join.
              </p>
              <CopyLink path={`/communities/${c.slug}`} label="Copy link" />
            </section>
          )}
          {c.mine?.status === "active" && c.mine.role !== "owner" && (
            <form action={leaveCommunity}>
              <input type="hidden" name="slug" value={c.slug} />
              <button type="submit" className="et-btn et-btn-ghost et-btn-sm">
                Leave community
              </button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
