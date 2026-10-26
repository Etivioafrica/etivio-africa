"use client";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Bookmark, CalendarDays, ExternalLink, Heart, Link2, Mail, MapPin, MessageCircle, MoreHorizontal, PenLine, Repeat2, Share2, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { alertDialog, confirmDialog } from "@/components/dash/dialogs";
import { ReportButton } from "@/components/moderation/ReportButton";
import type { CampusAuthor, CampusComment, CampusKind, CampusPoll, CampusPost, CampusQuote } from "@/lib/data/campus";
import { addCampusComment, campusProfileCard, createCampusPost, deleteCampusComment, deleteCampusPost, loadCampusComments, toggleCampusLike, toggleCampusRepost, toggleCampusSave, voteCampusPoll, type ProfileCard } from "./actions";
import { JOB_PAY, JOB_TYPE, type CampusJob, type CampusLink } from "./job";
import { KIND_STYLE } from "./kinds";


const CAMPUS_PLURAL: Record<CampusKind, string> = { update: "Updates", question: "Questions", win: "Wins", poll: "Polls", opportunity: "Opportunities" };

export type CampusViewer = { id: string; staff: boolean; name: string; avatar: string | null };

// "5m", "3h", "2d", then a date.
function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  if (mins < 7 * 24 * 60) return `${Math.round(mins / 1440)}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const youtubeId = (url: string | null) => url?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;

// Post text with #hashtags, @usernames and web links made clickable. Everything else stays plain text.
export function CampusText({ text, clamp }: { text: string; clamp?: number }) {
  const [open, setOpen] = useState(false);
  const long = !!clamp && text.length > clamp && !open;
  const shown = long ? `${text.slice(0, clamp).trimEnd()}…` : text;
  const parts = shown.split(/((?:^|(?<=\s))#[A-Za-z0-9_]{2,30}|(?:^|(?<=\s))@[A-Za-z0-9_.]{2,30}|https?:\/\/[^\s]+)/g);
  return (
    <p className="et-cps-text">
      {parts.map((p, i) => {
        if (p.startsWith("#") && p.length > 2)
          return (
            <Link key={i} href={`/campus?tag=${encodeURIComponent(p.slice(1).toLowerCase())}`}>
              {p}
            </Link>
          );
        if (p.startsWith("@") && p.length > 2)
          return (
            <Link key={i} href={`/u/${p.slice(1).toLowerCase().replace(/\.$/, "")}`}>
              {p}
            </Link>
          );
        if (/^https?:\/\//.test(p))
          return (
            <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow ugc">
              {p.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}
            </a>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
      {long && (
        <button type="button" className="et-cps-more" onClick={() => setOpen(true)}>
          Show more
        </button>
      )}
    </p>
  );
}

// Profiles already looked up this visit, so hovering again is instant.
const profiles = new Map<string, Promise<ProfileCard | null>>();

// A mini profile when the mouse rests on someone's name or photo (computers only; on a phone a tap opens the profile).
function HoverProfile({ author, children }: { author: CampusAuthor; children: React.ReactNode }) {
  const [card, setCard] = useState<ProfileCard | null>(null);
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function enter(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!profiles.has(author.id)) profiles.set(author.id, campusProfileCard(author.id).catch(() => null));
      profiles.get(author.id)!.then((c) => {
        setCard(c);
        setShow(!!c);
      });
    }, 450);
  }
  function leave() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 200);
  }
  return (
    <span className="et-cps-hover" onPointerEnter={enter} onPointerLeave={leave}>
      {children}
      {show && card && (
        <span className="et-cps-pcard" role="dialog" aria-label={card.name}>
          <span className="et-cps-pcard-top">
            <Avatar src={card.avatar} initial={card.name.charAt(0).toUpperCase()} seed={card.name} className="et-cps-face is-lg" />
            {card.username && (
              <Link href={`/u/${card.username}`} className="et-cps-pcard-btn">
                View profile
              </Link>
            )}
          </span>
          <b>
            {card.name} {card.badge && <span className="et-cps-badge">{card.badge}</span>}
          </b>
          {card.username && <small>@{card.username}</small>}
          {card.headline && <span className="et-cps-pcard-line">{card.headline}</span>}
          {card.bio && <span className="et-cps-pcard-bio">{card.bio}</span>}
          <span className="et-cps-pcard-meta">
            {card.location && (
              <span>
                <MapPin size={13} /> {card.location}
              </span>
            )}
            <span>
              <CalendarDays size={13} /> Joined {new Date(card.joined).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            </span>
          </span>
          <span className="et-cps-pcard-stat">
            <b>{card.posts}</b> {card.posts === 1 ? "post" : "posts"} on Campus
          </span>
        </span>
      )}
    </span>
  );
}

// One line like X: name, badge, @username · time. `plain` drops the profile links (inside a quoted post, which is itself a link).
function Who({ author, at, plain }: { author: CampusAuthor; at: string; plain?: boolean }) {
  const linked = !!author.username && !plain;
  return (
    <div className="et-cps-who">
      {linked ? (
        <HoverProfile author={author}>
          <Link href={`/u/${author.username}`} className="et-cps-name">
            {author.name}
          </Link>
        </HoverProfile>
      ) : (
        <span className="et-cps-name">{author.name}</span>
      )}
      {author.badge && <span className="et-cps-badge">{author.badge}</span>}
      <span className="et-cps-meta">
        {author.username && <>@{author.username} · </>}
        <time dateTime={at} suppressHydrationWarning>
          {ago(at)}
        </time>
      </span>
    </div>
  );
}

function Face({ author, plain, small }: { author: CampusAuthor; plain?: boolean; small?: boolean }) {
  const face = <Avatar src={author.avatar} initial={author.name.charAt(0).toUpperCase()} seed={author.name} className={`et-cps-face${small ? " is-sm" : ""}`} />;
  if (!author.username || plain) return face;
  return (
    <HoverProfile author={author}>
      <Link href={`/u/${author.username}`} className="et-cps-face-link">
        {face}
      </Link>
    </HoverProfile>
  );
}

// The posts after the first in a thread, joined by a line. The feed shows the next one; the post page shows them all.
function Thread({ post, full }: { post: CampusPost; full: boolean }) {
  const shown = full ? post.thread : post.thread.slice(0, 1);
  return (
    <ol className="et-cps-thread">
      {shown.map((text, i) => (
        <li key={i}>
          <Face author={post.author} small />
          <div>
            <Who author={post.author} at={post.createdAt} />
            <CampusText text={text} clamp={full ? undefined : 280} />
          </div>
        </li>
      ))}
      {!full && post.thread.length > 1 && (
        <li className="et-cps-thread-more">
          <Link href={`/campus/${post.id}`}>Show this thread ({post.thread.length + 1} posts)</Link>
        </li>
      )}
    </ol>
  );
}

function QuoteCard({ quote }: { quote: CampusQuote }) {
  return (
    <Link href={`/campus/${quote.id}`} className="et-cps-quote">
      <span className="et-cps-quote-head">
        <Avatar src={quote.author.avatar} initial={quote.author.name.charAt(0).toUpperCase()} seed={quote.author.name} className="et-cps-face is-xs" />
        <Who author={quote.author} at={quote.createdAt} plain />
      </span>
      {quote.body && <p className="et-cps-text">{quote.body.length > 280 ? `${quote.body.slice(0, 280)}…` : quote.body}</p>}
      {quote.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={quote.imageUrl} alt="" className="et-cps-quote-img" loading="lazy" />
      )}
    </Link>
  );
}

function LinkCard({ link }: { link: CampusLink }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer nofollow ugc" className={`et-cps-linkcard${link.image ? "" : " is-text"}`}>
      {link.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={link.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => e.currentTarget.remove()} />
      )}
      <span>
        <small>{link.site}</small>
        <b>{link.title}</b>
        {link.description && <em>{link.description}</em>}
      </span>
    </a>
  );
}

function JobCard({ job }: { job: CampusJob }) {
  const pay = JOB_PAY.find((p) => p.value === job.pay) ?? JOB_PAY[0];
  const type = JOB_TYPE.find((t) => t.value === job.type)?.label;
  const where = [job.location, job.remote ? "Remote" : ""].filter(Boolean).join(" · ");
  const apply = job.url || (job.email ? `mailto:${job.email}` : "");
  return (
    <div className="et-cps-jobcard">
      <div className="et-cps-jobcard-top">
        <span className="et-cps-jobcard-pay" style={{ background: pay.color }}>
          {pay.label}
        </span>
        {type && <span className="et-cps-jobcard-type">{type}</span>}
      </div>
      {(job.title || job.company) && (
        <b className="et-cps-jobcard-title">
          {job.title || "Opportunity"}
          {job.company && <span> at {job.company}</span>}
        </b>
      )}
      {(job.salary || where) && (
        <div className="et-cps-jobcard-meta">
          {job.salary && <span>{job.salary}</span>}
          {where && (
            <span>
              <MapPin size={13} /> {where}
            </span>
          )}
        </div>
      )}
      {apply && (
        <a href={apply} target="_blank" rel="noopener noreferrer nofollow ugc" className="et-cps-apply">
          {job.url ? <ExternalLink size={14} /> : <Mail size={14} />} Apply
        </a>
      )}
    </div>
  );
}

function Poll({ postId, poll }: { postId: string; poll: CampusPoll }) {
  const [mine, setMine] = useState(poll.mine);
  const [pending, start] = useTransition();
  const closed = poll.closed;
  const voted = mine.length > 0;
  const showResults = voted || closed;
  // Counts move with this person's vote straight away.
  const counts = poll.options.map((o) => o.votes - (poll.mine.includes(o.id) ? 1 : 0) + (mine.includes(o.id) ? 1 : 0));
  const total = counts.reduce((a, b) => a + b, 0);

  function choose(id: string) {
    if (closed) return;
    const next = poll.multiple ? (mine.includes(id) ? mine.filter((m) => m !== id) : [...mine, id]) : mine.includes(id) ? [] : [id];
    setMine(next);
    start(async () => {
      const res = await voteCampusPoll(postId, next);
      if (res.error) await alertDialog({ title: "Couldn't vote", body: res.error });
    });
  }

  return (
    <div className="et-cps-poll">
      {poll.options.map((o, i) => {
        const pct = total ? Math.round((counts[i] / total) * 100) : 0;
        return (
          <button key={o.id} type="button" className={`et-cps-opt${mine.includes(o.id) ? " is-mine" : ""}`} onClick={() => choose(o.id)} disabled={pending || closed}>
            {showResults && <span className="et-cps-opt-bar" style={{ width: `${pct}%` }} />}
            <span className="et-cps-opt-label">{o.label}</span>
            {showResults && <span className="et-cps-opt-pct">{pct}%</span>}
          </button>
        );
      })}
      <small className="et-cps-poll-foot" suppressHydrationWarning>
        {total} {total === 1 ? "vote" : "votes"}
        {poll.multiple ? " · Pick any" : ""}
        {poll.endsAt ? (closed ? " · Closed" : ` · Closes ${new Date(poll.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`) : ""}
      </small>
    </div>
  );
}

export function Comments({ postId, viewer, initial, onCount }: { postId: string; viewer: CampusViewer; initial?: CampusComment[]; onCount?: (n: number) => void }) {
  const [list, setList] = useState<CampusComment[] | null>(initial ?? null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CampusComment | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial) return;
    let live = true;
    loadCampusComments(postId).then((c) => live && setList(c));
    return () => {
      live = false;
    };
  }, [postId, initial]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setNote("");
    start(async () => {
      const res = await addCampusComment(postId, text, replyTo?.id ?? null);
      if ("error" in res && res.error) return setNote(res.error);
      if ("comments" in res && res.comments) {
        setList(res.comments);
        onCount?.(res.comments.length);
        if (res.held) setNote("Posted. Others will see it once the team has checked it.");
      }
      setDraft("");
      setReplyTo(null);
    });
  }

  async function remove(c: CampusComment) {
    if (!(await confirmDialog({ title: "Delete this comment?", confirmLabel: "Delete", danger: true }))) return;
    start(async () => {
      await deleteCampusComment(c.id);
      const next = (list ?? []).filter((x) => x.id !== c.id && x.parentId !== c.id);
      setList(next);
      onCount?.(next.length);
    });
  }

  const top = (list ?? []).filter((c) => !c.parentId);
  const replies = (id: string) => (list ?? []).filter((c) => c.parentId === id);
  const one = (c: CampusComment, isReply: boolean) => (
    <div key={c.id} className={`et-cps-comment${isReply ? " is-reply" : ""}`}>
      <Face author={c.author} small />
      <div className="et-cps-comment-main">
        <Who author={c.author} at={c.createdAt} />
        <CampusText text={c.body} />
        <div className="et-cps-comment-acts">
          {c.hidden && <span>Waiting for a check</span>}
          <button
            type="button"
            onClick={() => {
              setReplyTo(c);
              input.current?.focus();
            }}
          >
            Reply
          </button>
          {(c.author.id === viewer.id || viewer.staff) && (
            <button type="button" onClick={() => remove(c)}>
              Delete
            </button>
          )}
          {c.author.id !== viewer.id && <ReportButton type="campus_comment" id={c.id} small />}
        </div>
      </div>
    </div>
  );

  return (
    <div className="et-cps-comments">
      {list === null ? (
        <p className="et-muted">Loading comments…</p>
      ) : (
        top.map((c) => (
          <Fragment key={c.id}>
            {one(c, false)}
            {replies(c.id).map((r) => one(r, true))}
          </Fragment>
        ))
      )}
      {replyTo && (
        <p className="et-cps-replying">
          Replying to {replyTo.author.name}
          <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
            <X size={12} />
          </button>
        </p>
      )}
      <div className="et-cps-reply">
        <Avatar src={viewer.avatar} initial={viewer.name.charAt(0).toUpperCase()} seed={viewer.name} className="et-cps-face is-sm" />
        <input
          ref={input}
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={replyTo ? `Reply to ${replyTo.author.name}` : "Post your reply"}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="button" className="et-cps-reply-btn" onClick={send} disabled={pending || !draft.trim()}>
          Reply
        </button>
      </div>
      {note && <p className="et-cps-note">{note}</p>}
    </div>
  );
}

function QuoteModal({ post, onClose }: { post: CampusPost; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);
  const target = document.querySelector<HTMLElement>(".et-app") ?? document.body;
  const quote: CampusQuote = { id: post.id, kind: post.kind, body: post.body, imageUrl: post.imageUrl, createdAt: post.createdAt, author: post.author };

  function submit() {
    setError("");
    start(async () => {
      const res = await createCampusPost({ kind: "update", body: text, quotedId: post.id });
      if (res.error) return setError(res.error);
      setDone(res.ok ?? "Posted.");
      setTimeout(onClose, 900);
    });
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="et-modal et-cps-quote-modal"
      aria-label="Quote"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <div className="et-modal-head">
        <div>
          <h2>Quote</h2>
          <p>Add your thoughts. The post shows under them.</p>
        </div>
        <button type="button" className="et-icon-btn" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="et-modal-body">
        <textarea className="et-input" rows={3} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" autoFocus />
        <QuoteCard quote={quote} />
        {error && <p className="et-flash et-flash-err">{error}</p>}
        {done && <p className="et-flash et-flash-ok">{done}</p>}
      </div>
      <div className="et-modal-foot">
        <button type="button" className="et-btn et-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="et-btn et-btn-primary" onClick={submit} disabled={pending || !!done || !text.trim()}>
          <PenLine size={15} /> {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </dialog>,
    target,
  );
}

type CardProps = { post: CampusPost; viewer: CampusViewer; open?: boolean; clamp?: number; initialComments?: CampusComment[]; onDeleted?: () => void };

// A plain repost shows the original post whole, under "Name reposted".
export function PostCard(props: CardProps) {
  const { post, viewer, onDeleted } = props;
  if (post.repostOf) return <Card {...props} post={post.repostOf} repostedBy={post.author.id === viewer.id ? "You" : post.author.name} onUnreposted={post.author.id === viewer.id ? onDeleted : undefined} />;
  return <Card {...props} />;
}

function Card({ post, viewer, open: startOpen, clamp = 420, initialComments, onDeleted, repostedBy, onUnreposted }: CardProps & { repostedBy?: string; onUnreposted?: () => void }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [saved, setSaved] = useState(post.saved);
  const [comments, setComments] = useState(post.comments);
  const [open, setOpen] = useState(!!startOpen);
  const [quoting, setQuoting] = useState(false);
  const [repostMenu, setRepostMenu] = useState(false);
  const [reposted, setReposted] = useState(post.reposted);
  const [reposts, setReposts] = useState(post.reposts + post.quotes);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const yt = youtubeId(post.videoUrl);
  const mine = post.author.id === viewer.id;

  function like() {
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    start(async () => {
      const res = await toggleCampusLike(post.id);
      if (res.error) {
        setLiked(post.liked);
        setLikes(post.likes);
      }
    });
  }
  function repost() {
    setRepostMenu(false);
    const next = !reposted;
    setReposted(next);
    setReposts((n) => n + (next ? 1 : -1));
    start(async () => {
      const res = await toggleCampusRepost(post.id);
      if (res.error) {
        setReposted(post.reposted);
        setReposts(post.reposts + post.quotes);
        await alertDialog({ title: "Couldn't repost", body: res.error });
      } else if (!next) onUnreposted?.();
    });
  }
  useEffect(() => {
    if (!repostMenu) return;
    const off = (e: MouseEvent) => !(e.target as HTMLElement).closest(".et-cps-repost") && setRepostMenu(false);
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [repostMenu]);
  function save() {
    setSaved(!saved);
    start(async () => {
      const res = await toggleCampusSave(post.id);
      if (res.error) setSaved(post.saved);
    });
  }
  async function share() {
    const url = `${window.location.origin}/campus/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${post.author.name} on Etivio Campus`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/campus/${post.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  async function remove() {
    if (!(await confirmDialog({ title: "Delete this post?", body: "It's removed for everyone, with its comments.", confirmLabel: "Delete", danger: true }))) return;
    const res = await deleteCampusPost(post.id);
    if (res.error) await alertDialog({ title: "Couldn't delete it", body: res.error });
    else if (onDeleted) onDeleted();
    else router.push("/campus");
  }

  const k = KIND_STYLE[post.kind];
  const count = (n: number) => (n > 0 ? <span>{n.toLocaleString()}</span> : null);

  return (
    <article className="et-cps-post">
      {repostedBy && (
        <p className="et-cps-context">
          <Repeat2 size={14} /> {repostedBy} reposted
        </p>
      )}
      <header>
        <Face author={post.author} />
        <div className="et-cps-head-text">
          <Who author={post.author} at={post.createdAt} />
          <span className="et-cps-tags">
            <span className={`et-cps-kind ${k.className}`}>
              <k.icon size={13} /> {CAMPUS_PLURAL[post.kind]}
            </span>
            {post.hashtags.slice(0, 2).map((t) => (
              <Link key={t} href={`/campus?tag=${t}`} className="et-cps-tag">
                {t}
              </Link>
            ))}
          </span>
        </div>
        <PostMenu mine={mine} staff={viewer.staff} postId={post.id} saved={saved} onSave={save} onDelete={remove} onCopy={copyLink} />
      </header>
      {post.hidden && <p className="et-cps-held">Only you can see this until the Etivio team has checked it.</p>}
      {post.body && <CampusText text={post.body} clamp={clamp} />}
      {post.poll && <Poll postId={post.id} poll={post.poll} />}
      {post.imageUrl && (
        <a href={post.imageUrl} target="_blank" rel="noopener noreferrer" className="et-cps-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" loading="lazy" />
        </a>
      )}
      {yt && (
        <div className="et-cps-video">
          <iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="YouTube video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}
      {post.link && !post.imageUrl && !yt && <LinkCard link={post.link} />}
      {post.job && <JobCard job={post.job} />}
      {post.quoted && <QuoteCard quote={post.quoted} />}
      {post.quoteGone && <p className="et-cps-gone">The original post was deleted.</p>}
      {post.thread.length > 0 && <Thread post={post} full={!!startOpen} />}
      <footer>
        <button type="button" className={`et-cps-act is-like${liked ? " is-on" : ""}`} onClick={like} aria-pressed={liked} aria-label={`Like, ${likes}`}>
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
          {count(likes)}
        </button>
        <div className="et-cps-repost">
          <button type="button" className={`et-cps-act is-rt${reposted ? " is-on" : ""}`} onClick={() => setRepostMenu(!repostMenu)} aria-expanded={repostMenu} aria-haspopup="menu" aria-label={`Repost, ${reposts}`}>
            <Repeat2 size={19} />
            {count(reposts)}
          </button>
          {repostMenu && (
            <div className="et-cps-repost-menu" role="menu">
              <button type="button" role="menuitem" onClick={repost}>
                <Repeat2 size={17} /> {reposted ? "Undo repost" : "Repost"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setRepostMenu(false);
                  setQuoting(true);
                }}
              >
                <PenLine size={17} /> Quote
              </button>
            </div>
          )}
        </div>
        <button type="button" className={`et-cps-act is-reply${open ? " is-on" : ""}`} onClick={() => setOpen(!open)} aria-label={`Reply, ${comments}`}>
          <MessageCircle size={18} />
          {count(comments)}
        </button>
        <button type="button" className="et-cps-act is-share" onClick={share} aria-label="Share">
          <Share2 size={18} />
          {copied && <span>Copied</span>}
        </button>
        <button type="button" className={`et-cps-act is-save${saved ? " is-on" : ""}`} onClick={save} aria-pressed={saved} aria-label={saved ? "Saved" : "Save"}>
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </footer>
      {open && <Comments postId={post.id} viewer={viewer} initial={initialComments} onCount={setComments} />}
      {quoting && <QuoteModal post={post} onClose={() => setQuoting(false)} />}
    </article>
  );
}

// The ··· menu on a post. It stays mounted while closed so a report form opened from it survives.
function PostMenu({ mine, staff, postId, saved, onSave, onDelete, onCopy }: { mine: boolean; staff: boolean; postId: string; saved: boolean; onSave: () => void; onDelete: () => void; onCopy: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!box.current?.contains(t) && !t.closest(".et-report")) setOpen(false);
    };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="et-cps-menu" ref={box}>
      <button type="button" className="et-cps-menu-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label="More">
        <MoreHorizontal size={18} />
      </button>
      <div className={`et-cps-menu-list${open ? " is-open" : ""}`} role="menu" onClick={(e) => (e.target as HTMLElement).closest(".et-report-btn") && setOpen(false)}>
        <button type="button" role="menuitem" onClick={pick(onSave)}>
          <Bookmark size={17} /> {saved ? "Remove from saved" : "Save post"}
        </button>
        <button type="button" role="menuitem" onClick={pick(onCopy)}>
          <Link2 size={17} /> Copy link
        </button>
        {(mine || staff) && (
          <button type="button" role="menuitem" className="is-danger" onClick={pick(onDelete)}>
            <Trash2 size={17} /> Delete post
          </button>
        )}
        {!mine && <ReportButton type="campus_post" id={postId} label="Report post" />}
      </div>
    </div>
  );
}
