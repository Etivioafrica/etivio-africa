import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Check, Users, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { CopyLink } from "@/components/dash/CopyLink";
import { getCurrentUser } from "@/lib/auth";
import { JOIN_LABEL, communityFeed, getCommunity, pendingRequests } from "@/lib/data/communities";
import { decideRequest, leaveCommunity } from "../actions";
import { Composer, JoinBox, PostCard } from "./CommunityClient";

export const metadata = { title: "Community" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ invite?: string }> };

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
  const [{ slug }, { invite }, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const c = await getCommunity(slug, user.id, user.roles);
  if (!c) notFound();
  // Invite-only spaces stay hidden from people without the link.
  if (c.joinMode === "invite" && !c.isMember && invite !== c.invite_code) notFound();
  const [feed, requests] = await Promise.all([c.isMember ? communityFeed(c.id, user.id) : Promise.resolve([]), c.canModerate ? pendingRequests(c.id) : Promise.resolve([])]);

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
        </div>
      </section>

      <div className="et-cm-layout">
        <div className="et-cm-feed">
          {c.isMember ? (
            <>
              <Composer slug={c.slug} />
              {feed.length ? feed.map((p) => <PostCard key={p.id} post={p} canModerate={c.canModerate} viewerId={user.id} />) : <p className="et-muted et-cm-empty">No posts yet. Start the conversation.</p>}
            </>
          ) : (
            <section className="et-card et-card-pad">
              <h2 className="et-cm-join-title">Join to see posts and take part</h2>
              <JoinBox slug={c.slug} mode={c.joinMode} question={c.join_question} invite={invite ?? ""} pending={c.mine?.status === "pending"} />
            </section>
          )}
        </div>

        <aside className="et-cm-side">
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
