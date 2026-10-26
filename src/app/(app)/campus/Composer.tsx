"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Globe, ImagePlus, Link2, ListPlus, Loader2, Minus, Play, Plus, Smile, Video, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { uploadFile } from "@/lib/upload-client";
import type { CampusKind } from "@/lib/data/campus";
import { createCampusPost, findCampusPeople, previewCampusLink } from "./actions";
import { KIND_STYLE } from "./kinds";
import type { CampusViewer } from "./PostCard";
import { EMPTY_JOB, JOB_PAY, JOB_TYPE, firstLink, type CampusJob, type CampusLink } from "./job";

const DRAFT_KEY = "et-campus-draft";
export const OPEN_EVENT = "et-campus-compose";
const LIMIT = 5000;
const PLACEHOLDER: Record<CampusKind, string> = {
  update: "What are you learning today?",
  question: "What do you want to ask Campus?",
  win: "Finished a course? Landed a role? Tell everyone…",
  poll: "Ask your poll question…",
  opportunity: "Share a job, gig, scholarship or internship…",
};
const QUICK: [CampusKind, string][] = [
  ["question", "Ask"],
  ["win", "Win"],
  ["poll", "Poll"],
  ["opportunity", "Opportunity"],
];
const EMOJIS = ["😀", "😂", "🥹", "😍", "🤩", "😎", "🤔", "😅", "😭", "🙌", "👏", "🙏", "💪", "🤝", "👀", "🔥", "✨", "🎉", "🏆", "🚀", "💡", "📚", "✍️", "💻", "🎯", "✅", "💯", "❤️", "🌍", "🇳🇬"];

type Person = { username: string; name: string; avatar: string | null };

const isPhone = () => window.matchMedia("(max-width: 860px)").matches;

// Posting, the way it works on X: on a computer the box sits at the top of the feed and opens up when you click into
// it; on a phone, tapping it opens a full screen composer with Cancel and Post at the top and the tools above the keyboard.
export function Composer({ viewer }: { viewer: CampusViewer }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [kind, setKind] = useState<CampusKind>("update");
  const [body, setBody] = useState("");
  // The posts after the first one, when it's a thread.
  const [parts, setParts] = useState<string[]>([]);
  const [image, setImage] = useState<string | null>(null);
  // The picked photo shows straight away from the device while it uploads.
  const [photo, setPhoto] = useState<{ local: string; percent: number; checking: boolean } | null>(null);
  const uploading = !!photo && !image;
  const [videoOpen, setVideoOpen] = useState(false);
  const [video, setVideo] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [days, setDays] = useState(3);
  const [job, setJob] = useState<CampusJob>(EMPTY_JOB);
  const [link, setLink] = useState<CampusLink | null>(null);
  const [linkOff, setLinkOff] = useState<string | null>(null);
  const [emoji, setEmoji] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [mention, setMention] = useState<{ start: number; term: string } | null>(null);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  function restoreDraft(text = "") {
    let draft = "";
    try {
      draft = localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {}
    setBody((b) => b || text || draft);
  }

  function focusEnd() {
    requestAnimationFrame(() => {
      const t = area.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(t.value.length, t.value.length);
    });
  }

  // `withKind` comes from a starter prompt on an empty feed.
  function openComposer(withKind?: CampusKind, text = "", pickPhoto = false) {
    if (withKind) setKind(withKind);
    restoreDraft(text);
    setNote("");
    if (isPhone()) setSheet(true);
    else {
      setActive(true);
      box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      focusEnd();
    }
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
    if (sheet && el && !el.open) {
      el.showModal();
      focusEnd();
    }
  }, [sheet]);

  useEffect(() => {
    if (!active && !sheet) return;
    try {
      if (body) localStorage.setItem(DRAFT_KEY, body);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [body, active, sheet]);

  // The text box grows with the text.
  useEffect(() => {
    const t = area.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight}px`;
  }, [body, sheet, active, kind]);

  // Menus close on a click anywhere else.
  useEffect(() => {
    if (!emoji) return;
    const off = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest(".et-cps-emoji")) setEmoji(false);
    };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [emoji]);

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

  // A card for the first web link in the text, unless the post already has a photo, video or poll.
  const hasMedia = !!photo || videoOpen || kind === "poll";
  const url = hasMedia ? null : firstLink(body);
  const wanted = url && url !== linkOff ? url : null;
  useEffect(() => {
    if (!wanted || link?.url === wanted) return;
    let live = true;
    const t = setTimeout(() => previewCampusLink(wanted).then((l) => live && setLink(l ?? { url: wanted, title: "", description: "", image: "", site: "" })), 600);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [wanted, link?.url]);
  const card = link && link.url === wanted && link.title ? link : null;

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
  // Puts text where the cursor is (emoji).
  function insert(text: string) {
    const t = area.current;
    const from = t?.selectionStart ?? body.length;
    const to = t?.selectionEnd ?? from;
    setBody(body.slice(0, from) + text + body.slice(to));
    requestAnimationFrame(() => {
      t?.focus();
      t?.setSelectionRange(from + text.length, from + text.length);
    });
  }

  async function upload(f: File) {
    setError("");
    if (!f.type.startsWith("image/")) return setError("Pick a photo (JPG, PNG, WebP or GIF).");
    if (f.size > 10 * 1024 * 1024) return setError("Photos can be up to 10 MB.");
    removePhoto();
    if (kind === "poll") setKind("update");
    setVideo("");
    setVideoOpen(false);
    const local = URL.createObjectURL(f);
    setPhoto({ local, percent: 0, checking: false });
    try {
      const up = await uploadFile("post", f, f.name || "photo.jpg", {
        onProgress: (percent) => setPhoto((p) => (p && p.local === local ? { ...p, percent } : p)),
        onChecking: () => setPhoto((p) => (p && p.local === local ? { ...p, percent: 100, checking: true } : p)),
      });
      setPhoto((p) => (p && p.local === local ? { ...p, checking: false } : p));
      setImage(up.url);
    } catch (e) {
      setPhoto(null);
      URL.revokeObjectURL(local);
      setError((e as Error).message);
    }
  }
  function removePhoto() {
    if (photo) URL.revokeObjectURL(photo.local);
    setPhoto(null);
    setImage(null);
  }
  // A photo pasted into the text or dropped on the box.
  function takeFiles(files: FileList | null | undefined) {
    const f = [...(files ?? [])].find((x) => x.type.startsWith("image/"));
    if (f) {
      upload(f);
      return true;
    }
    return false;
  }
  function toggleVideo() {
    if (videoOpen) {
      setVideo("");
      setVideoOpen(false);
      return;
    }
    removePhoto();
    if (kind === "poll") setKind("update");
    setVideoOpen(true);
  }
  function togglePoll() {
    if (kind === "poll") return setKind("update");
    removePhoto();
    setVideo("");
    setVideoOpen(false);
    setKind("poll");
  }

  // Closing keeps what was typed as a draft; posting clears it.
  function closeSheet() {
    dialog.current?.close();
    setSheet(false);
    setMention(null);
    setEmoji(false);
    setError("");
  }
  function clear() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setBody("");
    setParts([]);
    removePhoto();
    setVideo("");
    setVideoOpen(false);
    setOptions(["", ""]);
    setMultiple(false);
    setJob(EMPTY_JOB);
    setLink(null);
    setLinkOff(null);
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
        job: kind === "opportunity" ? job : undefined,
        linkUrl: card?.url ?? null,
        thread: threads ? parts : undefined,
      });
      if (res.error) return setError(res.error);
      clear();
      closeSheet();
      setActive(false);
      area.current?.blur();
      setNote(res.ok && res.ok !== "Posted." ? res.ok : "");
      router.refresh();
    });
  }

  const left = LIMIT - body.length;
  const threads = kind !== "poll" && kind !== "opportunity";
  function addPart() {
    if (parts.length >= 24) return;
    setParts([...parts, ""]);
    // Focus the new box once it's on screen.
    setTimeout(() => document.querySelector<HTMLTextAreaElement>(".et-cps-part:last-of-type textarea")?.focus());
  }
  const ready = !uploading && left >= 0 && (!threads || parts.every((p) => p.length <= LIMIT)) && (kind === "poll" ? body.trim() && options.filter((o) => o.trim()).length >= 2 : body.trim() || image || video.trim());
  const face = <Avatar src={viewer.avatar} initial={viewer.name.charAt(0).toUpperCase()} seed={viewer.name} className="et-cps-face" />;
  // Shortcuts under the closed box, like the old In-House feed: each opens the composer as that type.
  const quick = (
    <div className="et-cps-quick">
      {QUICK.map(([k, label]) => {
        const Q = KIND_STYLE[k];
        return (
          <button key={k} type="button" onClick={() => openComposer(k)}>
            <Q.icon size={17} className={Q.className} /> {label}
          </button>
        );
      })}
    </div>
  );
  const yt = video.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;
  const target = typeof document === "undefined" ? null : (document.querySelector<HTMLElement>(".et-app") ?? document.body);
  const setJ = <F extends keyof CampusJob>(field: F, value: CampusJob[F]) => setJob((j) => ({ ...j, [field]: value }));

  const postButton = (
    <button type="button" className="et-cps-post-btn" onClick={submit} disabled={pending || !ready}>
      {pending ? <Loader2 size={15} className="et-spin" /> : "Post"}
    </button>
  );

  const toolbar = (full: boolean) => (
    <div className="et-cps-toolbar">
      <div className="et-cps-icons">
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => {
            takeFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button type="button" className={photo ? "is-on" : ""} onClick={() => file.current?.click()} disabled={uploading} aria-label="Add a photo" title="Photo">
          {uploading ? <Loader2 size={19} className="et-spin" /> : <ImagePlus size={19} />}
        </button>
        <button type="button" className={videoOpen ? "is-on" : ""} onClick={toggleVideo} aria-label="Add a YouTube video" title="YouTube video">
          <Video size={19} />
        </button>
        {threads && (
          <button type="button" className={parts.length ? "is-on" : ""} onClick={addPart} disabled={parts.length >= 24} aria-label="Add another post to make a thread" title="Thread">
            <ListPlus size={19} />
          </button>
        )}
        <div className="et-cps-emoji">
          <button type="button" className={emoji ? "is-on" : ""} onClick={() => setEmoji(!emoji)} aria-label="Add an emoji" aria-expanded={emoji} title="Emoji">
            <Smile size={19} />
          </button>
          {emoji && (
            <div className="et-cps-emoji-grid" role="listbox" aria-label="Emoji">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => insert(e)} aria-label={`Insert ${e}`}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="et-cps-send">
        {left <= 500 && (
          <span className={`et-cps-ring${left < 0 ? " is-over" : left <= 100 ? " is-near" : ""}`} aria-label={`${left} characters left`}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" className="et-cps-ring-bg" />
              <circle cx="12" cy="12" r="10" className="et-cps-ring-fg" strokeDasharray="62.8" strokeDashoffset={62.8 * Math.max(0, left / 500)} />
            </svg>
            {left <= 100 && <b>{left}</b>}
          </span>
        )}
        {!full && postButton}
      </div>
    </div>
  );

  const editor = (full: boolean) => {
    const open = full || active || !!body || parts.length > 0;
    return (
      <div
        ref={full ? undefined : box}
        className={`et-cps-box${full ? " is-full" : ""}${open ? " is-open" : ""}`}
        onDragOver={(e) => {
          if ([...e.dataTransfer.items].some((i) => i.type.startsWith("image/"))) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => e.target === e.currentTarget && setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          takeFiles(e.dataTransfer.files);
        }}
      >
        {full && (
          <div className="et-cps-box-head">
            <button type="button" className="et-cps-cancel" onClick={closeSheet}>
              Cancel
            </button>
            {postButton}
          </div>
        )}
        <div className="et-cps-box-main">
          {open ? (
            <div className="et-cps-who-row">
              {face}
              <span>
                <b>{viewer.name}</b>
                <small>
                  <Globe size={12} /> Everyone on Campus can see and reply
                </small>
              </span>
            </div>
          ) : (
            face
          )}
          <div className="et-cps-box-col">
            {open && (
              <div className="et-cps-types" role="radiogroup" aria-label="Post type">
                {(Object.keys(KIND_STYLE) as CampusKind[]).map((k) => {
                  const T = KIND_STYLE[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={kind === k}
                      className={`${T.className}${kind === k ? " is-on" : ""}`}
                      onClick={() => {
                        if (k === kind) return;
                        if (k === "poll") togglePoll();
                        else setKind(k);
                      }}
                    >
                      <T.icon size={15} /> {T.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="et-cps-area">
              <textarea
                ref={area}
                rows={1}
                maxLength={LIMIT + 200}
                value={body}
                aria-label="Post text"
                placeholder={PLACEHOLDER[kind]}
                onFocus={() => {
                  if (!full && !active) {
                    setActive(true);
                    restoreDraft();
                  }
                }}
                onChange={(e) => onType(e.target.value, e.target.selectionStart)}
                onPaste={(e) => {
                  if (takeFiles(e.clipboardData?.files)) e.preventDefault();
                }}
                onKeyDown={(e) => {
                  if (people.length && mention && e.key === "Enter") {
                    e.preventDefault();
                    pick(people[0]);
                  }
                  if (e.key === "Escape" && mention) {
                    e.stopPropagation();
                    setMention(null);
                  }
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && ready) submit();
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
                    <input className="et-input" value={o} maxLength={80} placeholder={`Choice ${i + 1}`} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
                    {options.length > 2 && (
                      <button type="button" className="et-icon-btn" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Remove choice">
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <div className="et-cps-pollopts">
                  {options.length < 4 && (
                    <button type="button" className="et-cps-addopt" onClick={() => setOptions([...options, ""])}>
                      <Plus size={14} /> Add a choice
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
                  <button type="button" className="et-cps-pollx" onClick={togglePoll}>
                    Remove poll
                  </button>
                </div>
              </div>
            )}

            {kind === "opportunity" && (
              <div className="et-cps-job">
                <div className="et-cps-job-head">
                  <b>Opportunity details</b>
                  <small>Optional. Posts with details get more applicants.</small>
                </div>
                <div className="et-cps-job-pay" role="radiogroup" aria-label="Pay">
                  {JOB_PAY.map((p) => (
                    <button key={p.value} type="button" role="radio" aria-checked={job.pay === p.value} className={job.pay === p.value ? "is-on" : ""} style={job.pay === p.value ? { background: p.color, borderColor: p.color } : undefined} onClick={() => setJ("pay", p.value)} title={p.hint}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="et-cps-job-grid">
                  <input className="et-input" value={job.title} maxLength={100} onChange={(e) => setJ("title", e.target.value)} placeholder="Role, e.g. Junior designer" aria-label="Role" />
                  <input className="et-input" value={job.company} maxLength={100} onChange={(e) => setJ("company", e.target.value)} placeholder="Company or organisation" aria-label="Company" />
                  <input className="et-input" value={job.salary} maxLength={80} onChange={(e) => setJ("salary", e.target.value)} placeholder="Pay, e.g. ₦250,000 a month" aria-label="Pay" />
                  <select className="et-input" value={job.type} onChange={(e) => setJ("type", e.target.value as CampusJob["type"])} aria-label="Type">
                    <option value="">Type (any)</option>
                    {JOB_TYPE.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input className="et-input" value={job.location} maxLength={80} onChange={(e) => setJ("location", e.target.value)} placeholder="Location, e.g. Lagos" aria-label="Location" />
                  <label className="et-cps-job-remote">
                    <input type="checkbox" checked={job.remote} onChange={(e) => setJ("remote", e.target.checked)} /> Remote is fine
                  </label>
                  <input className="et-input" value={job.url} maxLength={300} onChange={(e) => setJ("url", e.target.value)} placeholder="Link to apply (https://…)" inputMode="url" aria-label="Link to apply" />
                  <input className="et-input" value={job.email} maxLength={120} onChange={(e) => setJ("email", e.target.value)} placeholder="Or an email to apply to" inputMode="email" aria-label="Email to apply to" />
                </div>
              </div>
            )}

            {photo && (
              <div className={`et-cps-photo${uploading ? " is-uploading" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.local} alt="" />
                {uploading && (
                  <div className="et-cps-photo-status">
                    <span>{photo.checking ? "Checking photo…" : `Uploading ${photo.percent}%`}</span>
                    <i>
                      <b style={{ width: `${photo.checking ? 100 : photo.percent}%` }} />
                    </i>
                  </div>
                )}
                <button type="button" className="et-cps-photo-x" onClick={removePhoto} aria-label="Remove photo">
                  <X size={16} />
                </button>
              </div>
            )}
            {videoOpen && (
              <div className="et-cps-yt">
                {yt ? (
                  <div className="et-cps-yt-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" />
                    <span className="et-cps-yt-play">
                      <Play size={20} fill="currentColor" />
                    </span>
                    <button type="button" className="et-cps-photo-x" onClick={toggleVideo} aria-label="Remove video">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="et-cps-yt-input">
                    <Video size={18} className="is-video" />
                    <input value={video} onChange={(e) => setVideo(e.target.value)} placeholder="Paste a YouTube link" inputMode="url" autoFocus />
                    <button type="button" className="et-icon-btn" onClick={toggleVideo} aria-label="Cancel video">
                      <X size={15} />
                    </button>
                  </div>
                )}
                {video.trim() && !yt && <small>That doesn&apos;t look like a YouTube link yet.</small>}
              </div>
            )}
            {card && (
              <div className="et-cps-linkcard is-draft">
                {card.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.image} alt="" />
                )}
                <span>
                  <small>
                    <Link2 size={12} /> {card.site}
                  </small>
                  <b>{card.title}</b>
                </span>
                <button type="button" className="et-cps-photo-x" onClick={() => setLinkOff(card.url)} aria-label="Remove link preview">
                  <X size={16} />
                </button>
              </div>
            )}
            {threads && parts.length > 0 && (
              <ol className="et-cps-parts" aria-label="Thread">
                {parts.map((p, i) => (
                  <li key={i} className="et-cps-part">
                    {face}
                    <div>
                      <textarea
                        rows={2}
                        maxLength={LIMIT + 200}
                        value={p}
                        aria-label={`Post ${i + 2} of the thread`}
                        placeholder="Add another post"
                        onChange={(e) => setParts(parts.map((x, j) => (j === i ? e.target.value : x)))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && ready) submit();
                          if (e.key === "Backspace" && !p) {
                            e.preventDefault();
                            setParts(parts.filter((_, j) => j !== i));
                          }
                        }}
                      />
                      {p.length > LIMIT - 100 && <small className={p.length > LIMIT ? "is-over" : ""}>{LIMIT - p.length}</small>}
                    </div>
                    <button type="button" className="et-icon-btn" onClick={() => setParts(parts.filter((_, j) => j !== i))} aria-label={`Remove post ${i + 2}`}>
                      <X size={15} />
                    </button>
                  </li>
                ))}
                {parts.length < 24 && (
                  <li>
                    <button type="button" className="et-cps-part-add" onClick={addPart}>
                      <Plus size={15} /> Add another post
                    </button>
                  </li>
                )}
              </ol>
            )}
            {error && <p className="et-flash et-flash-err">{error}</p>}
            {!full && open && toolbar(false)}
          </div>
        </div>
        {!full && !open && quick}
        {full && toolbar(true)}
        {dragging && (
          <div className="et-cps-drop">
            <ImagePlus size={28} />
            Drop your photo here
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="et-cps-compose">
        {!sheet && editor(false)}
        {/* Phone: a tap target that opens the full screen composer. */}
        <div className="et-cps-mcard">
          <div className="et-cps-mtrigger">
            {face}
            <button type="button" className="et-cps-mtrigger-text" onClick={() => openComposer()}>
              {body ? body.slice(0, 60) : "What are you learning today?"}
            </button>
            <button type="button" className="et-cps-mtrigger-photo" onClick={() => openComposer(undefined, "", true)} aria-label="Post a photo">
              <ImagePlus size={20} />
            </button>
          </div>
          {quick}
        </div>
        {note && <p className="et-cps-note">{note}</p>}
      </div>

      {sheet &&
        target &&
        createPortal(
          <dialog
            ref={dialog}
            className="et-modal et-cps-sheet"
            aria-label="New post"
            onCancel={(e) => {
              e.preventDefault();
              closeSheet();
            }}
            onClick={(e) => e.target === dialog.current && closeSheet()}
          >
            {editor(true)}
          </dialog>,
          target,
        )}
    </>
  );
}
