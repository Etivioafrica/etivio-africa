"use client";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Bookmark, BarChart3, Briefcase, CalendarDays, ExternalLink, Heart, HelpCircle, Mail, MapPin, Megaphone, MessageCircle, PenLine, Repeat2, Send, Share2, Trash2, Trophy, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { alertDialog, confirmDialog } from "@/components/dash/dialogs";
import { ReportButton } from "@/components/moderation/ReportButton";
import type { CampusAuthor, CampusComment, CampusKind, CampusPoll, CampusPost, CampusQuote } from "@/lib/data/campus";
import { addCampusComment, campusProfileCard, createCampusPost, deleteCampusComment, deleteCampusPost, loadCampusComments, toggleCampusLike, toggleCampusRepost, toggleCampusSave, voteCampusPoll, type ProfileCard } from "./actions";
import { JOB_PAY, JOB_TYPE, type CampusJob, type CampusLink } from "./job";

export const KIND_STYLE: Record<CampusKind, { label: string; icon: LucideIcon; className: string }> = {
  update: { label: "Update", icon: Megaphone, className: "is-update" },
  question: { label: "Question", icon: HelpCircle, className: "is-question" },
  win: { label: "Win", icon: Trophy, className: "is-win" },
  poll: { label: "Poll", icon: BarChart3, className: "is-poll" },
  opportunity: { label: "Opportunity", icon: Briefcase, className: "is-opportunity" },
};

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

// `plain` drops the profile links (inside a quoted post, which is itself a link).
function Who({ author, at, kind, plain }: { author: CampusAuthor; at: string; kind?: CampusKind; plain?: boolean }) {
  const k = kind ? KIND_STYLE[kind] : null;
  const linked = !!author.username && !plain;
  const name = linked ? (
    <HoverProfile author={author}>
      <Link href={`/u/${author.username}`}>{author.name}</Link>
    </HoverProfile>
  ) : (
    <span>{author.name}</span>
  );
  return (
    <div className="et-cps-who">
      {linked ? (
        <HoverProfile author={author}>
          <Link href={`/u/${author.username}`} className="et-cps-face-link">
            <Avatar src={author.avatar} initial={author.name.charAt(0).toUpperCase()} seed={author.name} className="et-cps-face" />
          </Link>
        </HoverProfile>
      ) : (
        <Avatar src={author.avatar} initial={author.name.charAt(0).toUpperCase()} seed={author.name} className="et-cps-face" />
      )}
      <div className="et-cps-who-text">
        <div className="et-cps-name">
          <b>{name}</b>
          {author.badge && <span className="et-cps-badge">{author.badge}</span>}
        </div>
        <small>
          {author.username && <>@{author.username} · </>}
          <time dateTime={at} suppressHydrationWarning>
            {ago(at)}
          </time>
          {k && kind !== "update" && (
            <span className={`et-cps-kind ${k.className}`}>
              <k.icon size={11} /> {k.label}
            </span>
          )}
        </small>
      </div>
    </div>
  );
}

function QuoteCard({ quote }: { quote: CampusQuote }) {
  return (
    <Link href={`/campus/${quote.id}`} className="et-cps-quote">
      <Who author={quote.author} at={quote.createdAt} plain />
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
      <Avatar src={c.author.avatar} initial={c.author.name.charAt(0).toUpperCase()} seed={c.author.name} className="et-cps-face is-sm" />
      <div>
        <div className="et-cps-comment-bubble">
          <b>{c.author.username ? <Link href={`/u/${c.author.username}`}>{c.author.name}</Link> : c.author.name}</b>
          {c.author.badge && <span className="et-cps-badge">{c.author.badge}</span>}
          <CampusText text={c.body} />
        </div>
        <div className="et-cps-comment-acts">
          <time dateTime={c.createdAt} suppressHydrationWarning>
            {ago(c.createdAt)}
          </time>
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
          placeholder={replyTo ? `Reply to ${replyTo.author.name}…` : "Write a comment…"}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={send} disabled={pending || !draft.trim()} aria-label="Send comment">
          <Send size={13} />
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
  async function remove() {
    if (!(await confirmDialog({ title: "Delete this post?", body: "It's removed for everyone, with its comments.", confirmLabel: "Delete", danger: true }))) return;
    const res = await deleteCampusPost(post.id);
    if (res.error) await alertDialog({ title: "Couldn't delete it", body: res.error });
    else if (onDeleted) onDeleted();
    else router.push("/campus");
  }

  return (
    <article className="et-card et-cps-post">
      {repostedBy && (
        <p className="et-cps-reposted">
          <Repeat2 size={14} /> {repostedBy} reposted
        </p>
      )}
      <header>
        <Who author={post.author} at={post.createdAt} kind={post.kind} />
        <span className="et-cps-tools">
          <button type="button" className={`et-icon-btn${saved ? " is-saved" : ""}`} onClick={save} aria-pressed={saved} aria-label={saved ? "Saved" : "Save"} title={saved ? "Saved" : "Save"}>
            <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
          </button>
          {(mine || viewer.staff) && (
            <button type="button" className="et-icon-btn" onClick={remove} aria-label="Delete post" title="Delete post">
              <Trash2 size={14} />
            </button>
          )}
          {!mine && <ReportButton type="campus_post" id={post.id} />}
        </span>
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
      {(likes > 0 || comments > 0 || reposts > 0) && (
        <div className="et-cps-stats">
          {likes > 0 && (
            <span className="et-cps-stats-likes">
              <span className="et-cps-heart">
                <Heart size={10} fill="currentColor" />
              </span>
              {likes}
            </span>
          )}
          <span className="et-cps-stats-right">
            {comments > 0 && (
              <button type="button" onClick={() => setOpen(!open)}>
                {comments} {comments === 1 ? "comment" : "comments"}
              </button>
            )}
            {reposts > 0 && (
              <span>
                {reposts} {reposts === 1 ? "repost" : "reposts"}
              </span>
            )}
          </span>
        </div>
      )}
      <footer>
        <button type="button" className={`et-cps-act${liked ? " is-liked" : ""}`} onClick={like} aria-pressed={liked}>
          <Heart size={18} fill={liked ? "currentColor" : "none"} /> <span>Like</span>
        </button>
        <button type="button" className={`et-cps-act${open ? " is-on" : ""}`} onClick={() => setOpen(!open)}>
          <MessageCircle size={18} /> <span>Comment</span>
        </button>
        <div className="et-cps-repost">
          <button type="button" className={`et-cps-act${reposted ? " is-reposted" : ""}`} onClick={() => setRepostMenu(!repostMenu)} aria-expanded={repostMenu} aria-haspopup="menu">
            <Repeat2 size={19} /> <span>{reposted ? "Reposted" : "Repost"}</span>
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
        <button type="button" className="et-cps-act" onClick={share}>
          <Share2 size={18} /> <span>{copied ? "Copied" : "Share"}</span>
        </button>
      </footer>
      {open && <Comments postId={post.id} viewer={viewer} initial={initialComments} onCount={setComments} />}
      {quoting && <QuoteModal post={post} onClose={() => setQuoting(false)} />}
    </article>
  );
}
