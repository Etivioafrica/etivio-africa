"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowUp, BarChart3, ChevronDown, HelpCircle, ImagePlus, Loader2, Minus, Plus, Trophy, Video, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/upload-client";
import type { CampusKind, CampusPost, FeedQuery } from "@/lib/data/campus";
import { createCampusPost, findCampusPeople, loadMoreCampus } from "./actions";
import { KIND_STYLE, PostCard, type CampusViewer } from "./PostCard";

const DRAFT_KEY = "et-campus-draft";
const OPEN_EVENT = "et-campus-compose";
const PLACEHOLDER: Record<CampusKind, string> = {
  update: "What are you learning or working on?",
  question: "What do you want to ask Campus?",
  win: "Finished a course? Landed a role? Tell everyone…",
  poll: "Ask your poll question…",
  opportunity: "Share a job, gig, scholarship or internship…",
};

type Person = { username: string; name: string; avatar: string | null };

// Opens the composer from anywhere on the page (the starter prompts on an empty feed).
export function openCampusComposer(kind: CampusKind, text = "") {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { kind, text } }));
}

export function StarterPrompts() {
  const prompts: { kind: CampusKind; label: string; text: string }[] = [
    { kind: "update", label: "👋 Introduce yourself", text: "Hi Campus! I'm learning " },
    { kind: "question", label: "🙋 Ask a question", text: "" },
    { kind: "win", label: "🏆 Share a win", text: "" },
    { kind: "poll", label: "📊 Start a poll", text: "" },
  ];
  return (
    <div className="et-cps-starters">
      {prompts.map((p) => (
        <button key={p.label} type="button" onClick={() => openCampusComposer(p.kind, p.text)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

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
  const dialog = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  // Opening brings back an unsent post. `withKind` comes from a quick button or starter prompt.
  function openComposer(withKind?: CampusKind, text = "", pickPhoto = false) {
    let draft = "";
    try {
      draft = localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {}
    if (withKind) setKind(withKind);
    setBody((b) => b || text || draft);
    setNote("");
    setOpen(true);
    if (pickPhoto) setTimeout(() => file.current?.click(), 60);
  }

  useEffect(() => {
    const onOpen = (e: Event) => {
      const { kind: k, text } = (e as CustomEvent<{ kind: CampusKind; text: string }>).detail;
      openComposer(k, text);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  });

  useEffect(() => {
    const el = dialog.current;
    if (open && el && !el.open) {
      el.showModal();
      requestAnimationFrame(() => {
        const t = area.current;
        if (!t) return;
        t.focus();
        t.setSelectionRange(t.value.length, t.value.length);
      });
    }
  }, [open]);

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
    setBody(`${body.slice(0, mention.start)}@${p.username} ${body.slice(end)}`);
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

  // Closing keeps what was typed as a draft; posting clears it.
  function close() {
    dialog.current?.close();
    setOpen(false);
    setMention(null);
    setError("");
  }
  function clear() {
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
  }

  function submit() {
    setError("");
    start(async () => {
      const res = await createCampusPost({
        kind,
        body,
        imageUrl: image ?? undefined,
        videoUrl: video.trim() || undefined,
        poll: kind === "poll" ? { options, multiple, days } : undefined,
      });
      if (res.error) return setError(res.error);
      clear();
      close();
      if (res.ok && res.ok !== "Posted.") setNote(res.ok);
      router.refresh();
    });
  }

  const ready = kind === "poll" ? body.trim() && options.filter((o) => o.trim()).length >= 2 : body.trim() || image || video.trim();
  const face = <Avatar src={viewer.avatar} initial={viewer.name.charAt(0).toUpperCase()} seed={viewer.name} className="et-cps-face" />;
  const K = KIND_STYLE[kind];
  const target = typeof document === "undefined" ? null : (document.querySelector<HTMLElement>(".et-app") ?? document.body);

  return (
    <>
      <div className="et-cps-compose">
        <div className="et-cps-compose-row">
          {face}
          <button type="button" className="et-cps-compose-pill" onClick={() => openComposer()}>
            What are you learning today?
          </button>
        </div>
        <div className="et-cps-quick">
          <button type="button" onClick={() => openComposer("update", "", true)}>
            <ImagePlus size={17} className="is-photo" /> Photo
          </button>
          <button type="button" onClick={() => openComposer("question")}>
            <HelpCircle size={17} className="is-question" /> Ask
          </button>
          <button type="button" onClick={() => openComposer("poll")}>
            <BarChart3 size={17} className="is-poll" /> Poll
          </button>
          <button type="button" onClick={() => openComposer("win")}>
            <Trophy size={17} className="is-win" /> Win
          </button>
        </div>
        {note && <p className="et-cps-note">{note}</p>}
      </div>

      {open &&
        target &&
        createPortal(
          <dialog
            ref={dialog}
            className="et-modal et-cps-sheet"
            aria-label="Create post"
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
            onClick={(e) => e.target === dialog.current && close()}
          >
            <div className="et-cps-sheet-head">
              <button type="button" className="et-icon-btn" onClick={close} aria-label="Close">
                <X size={18} />
              </button>
              <h2>Create post</h2>
              <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={submit} disabled={pending || uploading || !ready}>
                {pending ? "Posting…" : "Post"}
              </button>
            </div>

            <div className="et-cps-sheet-body">
              <div className="et-cps-sheet-who">
                {face}
                <div>
                  <b>{viewer.name}</b>
                  <label className={`et-cps-kind-select ${K.className}`}>
                    <K.icon size={13} />
                    <select value={kind} onChange={(e) => setKind(e.target.value as CampusKind)} aria-label="Post type">
                      {(Object.keys(KIND_STYLE) as CampusKind[]).map((k) => (
                        <option key={k} value={k}>
                          {KIND_STYLE[k].label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
              </div>

              <div className="et-cps-area">
                <textarea
                  ref={area}
                  rows={5}
                  maxLength={5000}
                  value={body}
                  placeholder={PLACEHOLDER[kind]}
                  onChange={(e) => onType(e.target.value, e.target.selectionStart)}
                  onKeyDown={(e) => {
                    if (people.length && mention && e.key === "Enter") {
                      e.preventDefault();
                      pick(people[0]);
                    }
                    if (e.key === "Escape" && mention) {
                      e.stopPropagation();
                      setMention(null);
                    }
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
                      <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} /> More than one answer
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
              {videoOpen && <input className="et-input" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="Paste a YouTube link" inputMode="url" autoFocus />}
              {error && <p className="et-flash et-flash-err">{error}</p>}
            </div>

            <div className="et-cps-sheet-tools">
              <span>Add to your post</span>
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
              <button type="button" className="et-icon-btn" onClick={() => file.current?.click()} disabled={uploading || !!image} aria-label="Add a photo" title="Add a photo">
                {uploading ? <Loader2 size={19} className="et-spin" /> : <ImagePlus size={19} className="is-photo" />}
              </button>
              <button type="button" className={`et-icon-btn${videoOpen ? " is-on" : ""}`} onClick={() => setVideoOpen(!videoOpen)} aria-label="Add a YouTube video" title="Add a YouTube video">
                <Video size={19} className="is-video" />
              </button>
              <button type="button" className={`et-icon-btn${kind === "poll" ? " is-on" : ""}`} onClick={() => setKind(kind === "poll" ? "update" : "poll")} aria-label="Add a poll" title="Add a poll">
                <BarChart3 size={19} className="is-poll" />
              </button>
            </div>
          </dialog>,
          target,
        )}
    </>
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
