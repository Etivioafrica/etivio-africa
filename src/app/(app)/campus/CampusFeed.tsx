"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ImagePlus, Loader2, Minus, Plus, Video, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/upload-client";
import type { CampusKind, CampusPost, FeedQuery } from "@/lib/data/campus";
import { createCampusPost, findCampusPeople, loadMoreCampus } from "./actions";
import { KIND_STYLE, PostCard, type CampusViewer } from "./PostCard";

const DRAFT_KEY = "et-campus-draft";
const PLACEHOLDER: Record<CampusKind, string> = {
  update: "Share what you're learning or working on…",
  question: "Ask Campus a question…",
  win: "Finished a course? Landed a role? Share your win…",
  poll: "Ask the poll question…",
  opportunity: "Share a job, gig, scholarship or internship…",
};

type Person = { username: string; name: string; avatar: string | null };

export function Composer({ viewer }: { viewer: CampusViewer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CampusKind>("update");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [video, setVideo] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [days, setDays] = useState(3);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [mention, setMention] = useState<{ start: number; term: string } | null>(null);
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  // Opening the composer brings back an unsent post.
  function openComposer() {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved && !body) setBody(saved);
    } catch {}
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    try {
      if (body) localStorage.setItem(DRAFT_KEY, body);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [body, open]);

  // @mention suggestions for the word being typed.
  useEffect(() => {
    if (!mention || mention.term.length < 1) return;
    let live = true;
    const t = setTimeout(() => findCampusPeople(mention.term).then((p) => live && setPeople(p)), 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [mention]);

  function onType(value: string, caret: number) {
    setBody(value);
    const m = value.slice(0, caret).match(/(?:^|\s)@([a-z0-9_.]{0,30})$/i);
    if (m) setMention({ start: caret - m[1].length - 1, term: m[1] });
    else {
      setMention(null);
      setPeople([]);
    }
  }
  function pick(p: Person) {
    if (!mention) return;
    const end = mention.start + 1 + mention.term.length;
    const next = `${body.slice(0, mention.start)}@${p.username} ${body.slice(end)}`;
    setBody(next);
    setMention(null);
    setPeople([]);
    requestAnimationFrame(() => {
      const pos = mention.start + p.username.length + 2;
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
    });
  }

  async function upload(f: File) {
    setError("");
    setUploading(true);
    try {
      const up = await uploadFile("post", f, f.name);
      setImage(up.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setBody("");
    setImage(null);
    setVideo("");
    setVideoOpen(false);
    setOptions(["", ""]);
    setMultiple(false);
    setKind("update");
    setOpen(false);
  }

  function submit() {
    setError("");
    setNote("");
    start(async () => {
      const res = await createCampusPost({
        kind,
        body,
        imageUrl: image ?? undefined,
        videoUrl: video.trim() || undefined,
        poll: kind === "poll" ? { options, multiple, days } : undefined,
      });
      if (res.error) return setError(res.error);
      reset();
      if (res.ok && res.ok !== "Posted.") setNote(res.ok);
      router.refresh();
    });
  }

  const ready = kind === "poll" ? body.trim() && options.filter((o) => o.trim()).length >= 2 : body.trim() || image || video.trim();

  if (!open)
    return (
      <div className="et-card et-cps-compose is-closed">
        <Avatar src={viewer.avatar} initial={viewer.name.charAt(0).toUpperCase()} seed={viewer.name} className="et-cps-face" />
        <button type="button" onClick={openComposer}>
          Share an update, ask a question or post a win…
        </button>
        {note && <p className="et-cps-note">{note}</p>}
      </div>
    );

  return (
    <div className="et-card et-cps-compose">
      <div className="et-cps-kinds" role="radiogroup" aria-label="Post type">
        {(Object.keys(KIND_STYLE) as CampusKind[]).map((k) => {
          const s = KIND_STYLE[k];
          return (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className={`et-cps-kind-pick ${s.className}${kind === k ? " is-on" : ""}`} onClick={() => setKind(k)}>
              <s.icon size={13} /> {s.label}
            </button>
          );
        })}
      </div>
      <div className="et-cps-write">
        <Avatar src={viewer.avatar} initial={viewer.name.charAt(0).toUpperCase()} seed={viewer.name} className="et-cps-face" />
        <div className="et-cps-area">
          <textarea
            ref={area}
            rows={3}
            maxLength={5000}
            value={body}
            autoFocus
            placeholder={PLACEHOLDER[kind]}
            onChange={(e) => onType(e.target.value, e.target.selectionStart)}
            onKeyDown={(e) => {
              if (people.length && mention && e.key === "Enter") {
                e.preventDefault();
                pick(people[0]);
              }
              if (e.key === "Escape") setMention(null);
            }}
          />
          {mention && people.length > 0 && (
            <ul className="et-cps-mentions" role="listbox">
              {people.map((p) => (
                <li key={p.username}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                    <Avatar src={p.avatar} initial={p.name.charAt(0).toUpperCase()} seed={p.name} className="et-cps-face is-sm" />
                    <span>
                      <b>{p.name}</b>
                      <small>@{p.username}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {kind === "poll" && (
        <div className="et-cps-pollmaker">
          {options.map((o, i) => (
            <div key={i} className="et-cps-pollrow">
              <input className="et-input" value={o} maxLength={80} placeholder={`Option ${i + 1}`} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
              {options.length > 2 && (
                <button type="button" className="et-icon-btn" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Remove option">
                  <Minus size={14} />
                </button>
              )}
            </div>
          ))}
          <div className="et-cps-pollopts">
            {options.length < 4 && (
              <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setOptions([...options, ""])}>
                <Plus size={13} /> Add option
              </button>
            )}
            <label>
              <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} /> Allow more than one answer
            </label>
            <label>
              Closes in
              <select className="et-input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[1, 3, 7, 14].map((d) => (
                  <option key={d} value={d}>
                    {d} {d === 1 ? "day" : "days"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {image && (
        <div className="et-cps-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" />
          <button type="button" className="et-icon-btn" onClick={() => setImage(null)} aria-label="Remove image">
            <X size={14} />
          </button>
        </div>
      )}
      {videoOpen && <input className="et-input et-cps-video-input" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="Paste a YouTube link" inputMode="url" />}

      <div className="et-cps-compose-foot">
        <div className="et-cps-attach">
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <button type="button" className="et-icon-btn" onClick={() => file.current?.click()} disabled={uploading || !!image} aria-label="Add a picture" title="Add a picture">
            {uploading ? <Loader2 size={16} className="et-spin" /> : <ImagePlus size={16} />}
          </button>
          <button type="button" className={`et-icon-btn${videoOpen ? " is-on" : ""}`} onClick={() => setVideoOpen(!videoOpen)} aria-label="Add a YouTube video" title="Add a YouTube video">
            <Video size={16} />
          </button>
          <small>Use #tags and @usernames</small>
        </div>
        <div className="et-cps-send">
          <button
            type="button"
            className="et-btn et-btn-ghost et-btn-sm"
            onClick={() => {
              reset();
              setError("");
            }}
          >
            Cancel
          </button>
          <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={submit} disabled={pending || uploading || !ready}>
            {pending ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
      {error && <p className="et-flash et-flash-err">{error}</p>}
    </div>
  );
}

// Shows "N new posts" when other people post while you're reading.
export function NewPosts({ viewerId }: { viewerId: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [pending, start] = useTransition();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("campus-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "campus_posts" }, (payload) => {
        const row = payload.new as { author_id?: string; hidden?: boolean };
        if (row.author_id !== viewerId && !row.hidden) setCount((n) => n + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewerId]);
  if (!count) return null;
  return (
    <button
      type="button"
      className="et-cps-new"
      onClick={() =>
        start(() => {
          router.refresh();
          setCount(0);
          window.scrollTo({ top: 0, behavior: "smooth" });
        })
      }
    >
      {pending ? <Loader2 size={14} className="et-spin" /> : <ArrowUp size={14} />}
      Show {count} new {count === 1 ? "post" : "posts"}
    </button>
  );
}

export function FeedList({ initial, more: initialMore, viewer, query, empty }: { initial: CampusPost[]; more: boolean; viewer: CampusViewer; query: FeedQuery; empty: React.ReactNode }) {
  const [extra, setExtra] = useState<CampusPost[]>([]);
  const [more, setMore] = useState(initialMore);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const posts = [...initial, ...extra.filter((p) => !initial.some((i) => i.id === p.id))].filter((p) => !gone.has(p.id));

  function loadMore() {
    const last = posts[posts.length - 1];
    if (!last) return;
    start(async () => {
      const res = await loadMoreCampus({ ...query, before: last.createdAt });
      setExtra((e) => [...e, ...res.posts]);
      setMore(res.more);
    });
  }

  if (!posts.length) return <>{empty}</>;
  return (
    <>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} viewer={viewer} onDeleted={() => setGone((g) => new Set(g).add(p.id))} />
      ))}
      {more && (
        <button type="button" className="et-btn et-btn-ghost et-cps-loadmore" onClick={loadMore} disabled={pending}>
          {pending ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
