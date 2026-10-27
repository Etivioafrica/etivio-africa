"use client";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { BadgeCheck, Camera, Check, Crown, Globe, GraduationCap, ImagePlus, Link2, Lock, Trash2, UserCheck, Users } from "lucide-react";
import { Select } from "@/components/dash/Select";
import { CropUpload, type CropUploadHandle } from "@/components/dash/CropUpload";
import { slugify } from "@/lib/format";
import { createCommunity } from "../actions";

const MODES = [
  { value: "open", icon: Globe, label: "Anyone can join", hint: "People join straight away.", short: "Anyone can join" },
  { value: "request", icon: UserCheck, label: "Request to join", hint: "People answer a question; you approve them.", short: "Request to join" },
  { value: "course", icon: GraduationCap, label: "Students of a course", hint: "Anyone enrolled in the course can join.", short: "For students of a course" },
  { value: "invite", icon: Lock, label: "Invite only", hint: "Only people with the invite link can join.", short: "Invite only" },
] as const;
type Mode = (typeof MODES)[number]["value"];

const NAME_MAX = 80;
const DESC_MAX = 600;

export function CreateCommunityForm({ courses, canOfficial }: { courses: { id: string; title: string }[]; canOfficial: boolean }) {
  const [state, action] = useActionState(createCommunity, null);
  const coverModal = useRef<CropUploadHandle>(null);
  const [mode, setMode] = useState<Mode>("open");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cover, setCover] = useState("");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [official, setOfficial] = useState(false);

  const slug = slugify(name).slice(0, 50);
  const shown = name.trim() || "Your community";
  const courseTitle = courses.find((c) => c.id === courseId)?.title;
  const ready = name.trim().length >= 3 && (mode !== "course" || !!courseId);
  const checks = [
    { label: "A name (3+ characters)", done: name.trim().length >= 3 },
    { label: "A description (optional)", done: desc.trim().length > 0 },
    { label: "A cover image (optional)", done: !!cover },
    { label: "Who can join", done: mode !== "course" || !!courseId },
  ];
  const modeLabel = mode === "course" && courseTitle ? `For ${courseTitle}` : MODES.find((m) => m.value === mode)!.short;

  return (
    <form action={action} className="et-cmn">
      <input type="hidden" name="join_mode" value={mode} />
      <input type="hidden" name="cover_url" value={cover} />

      <div className="et-cmn-main">
        <section className="et-card et-cmn-sec">
          <header>
            <span>1</span>
            <div>
              <h2>The basics</h2>
              <p>A name, a line on what people do here and, if you like, a cover.</p>
            </div>
          </header>

          <div className="et-cmn-head">
            <div className="et-cmn-cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
              <div className="et-cmn-cover-tools">
                <button type="button" className="et-btn et-btn-sm" onClick={() => coverModal.current?.open()}>
                  {cover ? <Camera size={14} /> : <ImagePlus size={14} />} {cover ? "Change cover" : "Add cover"}
                </button>
                {cover && (
                  <button type="button" className="et-btn et-btn-sm" onClick={() => setCover("")} aria-label="Remove cover">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <span className="et-cmn-badge" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
              {!cover && shown.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="et-field">
            <label htmlFor="cm-name">
              Name <em>{name.length}/{NAME_MAX}</em>
            </label>
            <input id="cm-name" name="name" maxLength={NAME_MAX} required minLength={3} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Web design learners" autoFocus />
            <small className="et-cmn-url">
              <Link2 size={12} />
              <span>
                etivio.co/communities/<b>{slug || "your-community"}</b>
              </span>
            </small>
          </div>
          <div className="et-field">
            <label htmlFor="cm-desc">
              What it&apos;s about <em>{desc.length}/{DESC_MAX}</em>
            </label>
            <textarea id="cm-desc" name="description" rows={4} maxLength={DESC_MAX} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Who it's for and what people do here." />
          </div>
        </section>

        <section className="et-card et-cmn-sec">
          <header>
            <span>2</span>
            <div>
              <h2>Who can join</h2>
              <p>Pick how people get in. This sets who can see and join it.</p>
            </div>
          </header>
          <div className="et-cmn-modes" role="radiogroup" aria-label="Who can join">
            {MODES.map((m) => {
              const off = m.value === "course" && !courses.length;
              const Icon = m.icon;
              return (
                <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} className={mode === m.value ? "is-on" : ""} onClick={() => setMode(m.value)} disabled={off}>
                  <span className="et-cmn-mode-icon">
                    <Icon size={18} />
                  </span>
                  <span className="et-cmn-mode-text">
                    <b>{m.label}</b>
                    <small>{off ? "Publish a course first to link it." : m.hint}</small>
                  </span>
                  <span className="et-cmn-radio" aria-hidden />
                </button>
              );
            })}
          </div>
          {mode === "request" && (
            <div className="et-field et-cmn-extra">
              <label htmlFor="cm-q">Question for people asking to join</label>
              <input id="cm-q" name="join_question" maxLength={200} placeholder="e.g. What do you hope to learn here?" />
            </div>
          )}
          {mode === "course" && (
            <div className="et-field et-cmn-extra">
              <label htmlFor="cm-course">Course</label>
              <Select id="cm-course" name="course_id" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {mode === "invite" && <p className="et-cmn-note">Once it&apos;s created you&apos;ll get an invite link to share from the community page.</p>}
        </section>

        {canOfficial && (
          <label className="et-card et-cmn-official">
            <span className="et-cmn-mode-icon">
              <BadgeCheck size={18} />
            </span>
            <span className="et-cmn-mode-text">
              <b>Official Etivio community</b>
              <small>Shows a verified badge and is listed first.</small>
            </span>
            <input type="checkbox" name="official" className="et-toggle" checked={official} onChange={(e) => setOfficial(e.target.checked)} />
          </label>
        )}

        {state?.error && <p className="et-flash et-flash-err">{state.error}</p>}
        <div className="et-cmn-foot">
          <Link href="/communities" className="et-btn et-btn-ghost">
            Cancel
          </Link>
          <Submit disabled={!ready} />
        </div>
      </div>

      <aside className="et-cmn-side">
        <small className="et-cmn-side-label">Preview</small>
        <div className="et-card et-cmn-preview">
          <div className="et-cmn-hero" style={cover ? { backgroundImage: `linear-gradient(transparent 20%, rgba(0,0,0,.75)), url(${cover})` } : undefined}>
            <b>
              {shown} {official && <BadgeCheck size={15} />}
            </b>
            <small>
              <Users size={12} /> 1 member · {modeLabel}
            </small>
          </div>
          <p className={desc.trim() ? "" : "is-empty"}>{desc.trim() || "Your description shows here."}</p>
        </div>
        <small className="et-cmn-side-label">In the communities list</small>
        <div className="et-cm-card et-cmn-listcard">
          <span className="et-cm-cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
            {!cover && shown.charAt(0).toUpperCase()}
          </span>
          <span className="et-cm-card-body">
            <b>
              {shown} {official && <BadgeCheck size={15} className="et-cm-official" />}
            </b>
            {desc.trim() && <small className="et-cm-desc">{desc}</small>}
            <small className="et-cm-meta">
              <Users size={13} /> 1 member · {modeLabel}
            </small>
          </span>
        </div>
        <div className="et-card et-cmn-ready">
          <b>Ready to create</b>
          <ul>
            {checks.map((c) => (
              <li key={c.label} className={c.done ? "is-done" : ""}>
                <span>{c.done && <Check size={11} strokeWidth={3} />}</span>
                {c.label}
              </li>
            ))}
          </ul>
          <Submit disabled={!ready} />
          <small>
            <Crown size={13} /> You&apos;ll be the owner: approve requests, pin posts and remove members.
          </small>
        </div>
      </aside>

      <CropUpload
        ref={coverModal}
        kind="banner"
        out={{ width: 1600, height: 500 }}
        title="Community cover"
        hint="Wide images work best. JPG, PNG or WebP, up to 20 MB."
        confirmLabel="Use this image"
        onUploaded={async (url) => {
          setCover(url);
          return {};
        }}
      />
    </form>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="et-btn et-btn-primary" disabled={pending || disabled}>
      {pending ? "Creating…" : "Create community"}
    </button>
  );
}
