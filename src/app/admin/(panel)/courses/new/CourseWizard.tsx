"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { COURSE_STATUS_LABEL, type CourseStatus } from "@/lib/course-status";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CloudUpload, ImagePlus, Plus, Sparkles, Trash2, X } from "lucide-react";
import { aiCopy, aiCover, aiOutline } from "@/app/(app)/teach/ai-actions";
import { CropUpload, type CropUploadHandle } from "@/components/dash/CropUpload";
import { useToast } from "@/components/dash/useToast";
import type { Category } from "@/components/dash/CategoryManager";
import { createCourseFull, updateCourseFull, type Created, type LessonFile } from "../actions";
import { LessonCard, hasText, type LessonPatch, type WizLesson } from "./LessonCard";
import { Select } from "@/components/dash/Select";
import { confirmDialog } from "@/components/dash/dialogs";

type Level = "beginner" | "intermediate" | "advanced";
type Mod = { key: number; id?: string; title: string; lessons: WizLesson[] };
export type WizardInitial = {
  title: string;
  summary: string;
  description: string;
  skills: string;
  instructorId: string;
  categoryId: string;
  level: Level;
  coverUrl: string;
  priceNaira: number;
  listed: boolean;
  group?: GroupBuy;
  modules: { id: string; title: string; lessons: { id: string; title: string; videoUrl: string; hostedVideo: boolean; content: string; files: LessonFile[] }[] }[];
};
export type GroupBuy = { enabled: boolean; size: number; discount: number; days: number };
const GROUP_DEFAULT: GroupBuy = { enabled: false, size: 5, discount: 20, days: 7 };
const STEPS = ["Basics", "Curriculum", "Pricing", "Review"] as const;
// Wait this long after the last change before autosaving an existing course.
const AUTOSAVE_MS = 1200;
type SaveState = "saved" | "pending" | "saving" | "error";
let uid = 0;
const nextKey = () => ++uid;
const newLesson = (): WizLesson => ({ key: nextKey(), title: "", videoUrl: "", content: "", files: [] });

// Four steps: basics, curriculum outline, pricing, then review. Used to create a course and, with `edit`, to change one.
export function CourseWizard({
  instructors,
  categories,
  defaultInstructor,
  initial,
  edit,
  tutor,
}: {
  instructors: { id: string; label: string }[];
  categories: Category[];
  defaultInstructor: string;
  initial?: WizardInitial;
  edit?: { courseId: string; status: CourseStatus; students: number };
  // Set for tutors (/teach): they're always the instructor, and publishing means submitting for review unless
  // `canPublish` (trusted tutor, or the course was approved before).
  tutor?: { canPublish: boolean };
}) {
  const base = tutor ? "/teach/courses" : "/admin/courses";
  const router = useRouter();
  const [toast, show] = useToast();
  const [saving, start] = useTransition();
  const cover = useRef<CropUploadHandle>(null);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [skills, setSkills] = useState(initial?.skills ?? "");
  const [instructorId, setInstructorId] = useState(initial?.instructorId ?? (instructors.some((i) => i.id === defaultInstructor) ? defaultInstructor : (instructors[0]?.id ?? "")));
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [level, setLevel] = useState<Level>(initial?.level ?? "beginner");
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? "");
  const [paid, setPaid] = useState((initial?.priceNaira ?? 0) > 0);
  const [listed, setListed] = useState(initial?.listed ?? true);
  const [group, setGroup] = useState<GroupBuy>(initial?.group ?? GROUP_DEFAULT);
  const setG = (patch: Partial<GroupBuy>) => setGroup((g) => ({ ...g, ...patch }));
  // AI helpers: which one is running, and whether the outline should research the web first.
  const [aiBusy, setAiBusy] = useState<"copy" | "cover" | "outline" | null>(null);
  const [aiWeb, setAiWeb] = useState(true);
  const [price, setPrice] = useState(initial?.priceNaira ? String(initial.priceNaira) : "");
  const [modules, setModules] = useState<Mod[]>(() =>
    initial?.modules.length
      ? initial.modules.map((m) => ({ key: nextKey(), id: m.id, title: m.title, lessons: m.lessons.map((l) => ({ key: nextKey(), ...l })) }))
      : [{ key: nextKey(), title: "Getting started", lessons: [newLesson()] }],
  );
  const [drag, setDrag] = useState<{ m: number; l: number } | null>(null);
  const [openLesson, setOpenLesson] = useState<number | null>(null);
  const [error, setError] = useState("");

  const lessonTotal = modules.reduce((n, m) => n + m.lessons.filter((l) => l.title.trim()).length, 0);
  const parents = categories.filter((c) => !c.parent_id);
  const catLabel = (() => {
    const c = categories.find((x) => x.id === categoryId);
    if (!c) return "None";
    const p = categories.find((x) => x.id === c.parent_id);
    return p ? `${p.name} › ${c.name}` : c.name;
  })();
  const priceNum = Number(price.replace(/[^\d.]/g, ""));

  function check(s: number) {
    if (s === 0 && title.trim().length < 3) return "Give the course a title of at least 3 characters.";
    if (s === 0 && !instructorId) return "Pick an instructor.";
    if (s === 2 && paid && !(priceNum >= 500)) return "Paid courses need a price of at least ₦500.";
    if (s === 2 && paid && group.enabled) {
      if (!(group.size >= 2 && group.size <= 50)) return "Group size must be between 2 and 50 people.";
      if (!(group.discount >= 10 && group.discount <= 40)) return "The group discount must be between 10% and 40%.";
      if (!(group.days >= 1 && group.days <= 30)) return "Days to fill must be between 1 and 30.";
    }
    return "";
  }

  function go(to: number) {
    for (let s = 0; s < to; s++) {
      const e = check(s);
      if (e) {
        setStep(s);
        return setError(e);
      }
    }
    setError("");
    setStep(to);
  }

  const setMod = (mi: number, patch: Partial<Mod>) => setModules((ms) => ms.map((m, i) => (i === mi ? { ...m, ...patch } : m)));

  async function aiDetails() {
    setAiBusy("copy");
    const res = await aiCopy({ title, level, outline: modules.flatMap((m) => m.lessons.map((l) => l.title)).filter(Boolean) });
    setAiBusy(null);
    if (!res.ok) return show({ error: res.error });
    if (res.data.summary) setSummary(res.data.summary);
    if (res.data.description) setDescription(res.data.description);
    if (res.data.skills.length) setSkills(res.data.skills.join(", "));
    show({ ok: "Details written. Read them through and edit anything that isn't right." });
  }

  async function aiMakeCover() {
    setAiBusy("cover");
    const res = await aiCover({ title, summary });
    setAiBusy(null);
    if (!res.ok) return show({ error: res.error });
    setCoverUrl(res.data);
  }

  async function aiPlan() {
    const hasContent = modules.some((m) => m.title.trim() || m.lessons.some((l) => l.title.trim()));
    const warning = edit?.students ? ` ${edit.students} enrolled learners would lose progress on removed lessons.` : "";
    if (hasContent && !(await confirmDialog({ title: "Replace the curriculum with an AI outline?", body: `Your current modules and lessons are replaced.${warning}`, confirmLabel: "Replace", danger: Boolean(warning) }))) return;
    setAiBusy("outline");
    const res = await aiOutline({ title, summary, level, useWeb: aiWeb });
    setAiBusy(null);
    if (!res.ok) return show({ error: res.error });
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    setModules(
      res.data.modules.map((m) => ({
        key: nextKey(),
        title: m.title,
        lessons: m.lessons.map((l) => ({ key: nextKey(), title: l.title, videoUrl: "", content: l.summary ? `<p>${esc(l.summary)}</p>` : "", files: [] })),
      })),
    );
    show({ ok: "Outline added. Rename, reorder or delete anything, then add videos and notes to each lesson." });
  }
  const setLesson = (mk: number, lk: number, patch: LessonPatch) =>
    setModules((ms) =>
      ms.map((m) => (m.key !== mk ? m : { ...m, lessons: m.lessons.map((l) => (l.key !== lk ? l : { ...l, ...(typeof patch === "function" ? patch(l) : patch) })) })),
    );
  const addLesson = (mi: number, at: number) => {
    const l = newLesson();
    setModules((ms) => ms.map((m, i) => (i === mi ? { ...m, lessons: [...m.lessons.slice(0, at), l, ...m.lessons.slice(at)] } : m)));
    return l;
  };
  const lessonPayload = () =>
    modules.map((m) => ({
      id: m.id,
      key: String(m.key),
      title: m.title,
      lessons: m.lessons.map((l) => ({ id: l.id, key: String(l.key), title: l.title, videoUrl: l.videoUrl, content: l.content, files: l.files })),
    }));
  const moveLesson = (from: { m: number; l: number }, to: { m: number; l: number }) =>
    setModules((ms) => {
      const copy = ms.map((m) => ({ ...m, lessons: [...m.lessons] }));
      const [item] = copy[from.m].lessons.splice(from.l, 1);
      copy[to.m].lessons.splice(to.l, 0, item);
      return copy;
    });

  const fields = () => ({ title, summary, description, skills, instructorId, categoryId, level, coverUrl, priceNaira: paid ? String(priceNum) : "0", listed, group: { ...group, enabled: paid && group.enabled }, modules: lessonPayload() });
  // What the course looks like, without row ids, so merging ids after a save doesn't count as a change.
  const snapshot = JSON.stringify({
    ...fields(),
    modules: modules.map((m) => ({ t: m.title, l: m.lessons.map((l) => [l.title, l.videoUrl, l.content, l.files.map((f) => f.url)]) })),
  });
  const [savedSnap, setSavedSnap] = useState(snapshot);
  // A version the server rejected; don't retry it until something changes.
  const [failedSnap, setFailedSnap] = useState("");
  const inFlight = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const dirty = snapshot !== savedSnap;

  function mergeCreated(c: Created) {
    setModules((ms) =>
      ms.map((m) => ({
        ...m,
        id: m.id ?? c.modules[String(m.key)],
        lessons: m.lessons.map((l) => ({ ...l, id: l.id ?? c.lessons[String(l.key)], files: l.files.map((f) => (f.id ? f : { ...f, id: c.files[f.url] })) })),
      })),
    );
  }

  // Existing courses save themselves shortly after each change. Publishing still happens from the Review step.
  useEffect(() => {
    if (!edit || !dirty || inFlight.current || snapshot === failedSnap) return;
    const problem = check(0) || check(2);
    const t = setTimeout(async () => {
      if (problem) {
        setFailedSnap(snapshot);
        setSaveState("error");
        return setSaveError(problem);
      }
      inFlight.current = true;
      setSaveState("saving");
      const sent = snapshot;
      const res = await updateCourseFull(edit.courseId, { ...fields(), status: "keep", quiet: true });
      inFlight.current = false;
      if (res.error) {
        setFailedSnap(sent);
        setSaveState("error");
        setSaveError(res.error);
        return;
      }
      setSavedSnap(sent);
      if (res.created) mergeCreated(res.created);
      setSaveError("");
      setSaveState("saved");
    }, AUTOSAVE_MS);
    setSaveState((s) => (s === "saving" ? s : "pending"));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, saveState]);

  // Warn before leaving with changes that haven't reached the server yet.
  useEffect(() => {
    if (!edit || !dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [edit, dirty]);

  async function saveEdit(status: "keep" | "draft" | "pending" | "published") {
    if (!edit) return;
    const removed = initial!.modules.flatMap((m) => m.lessons).filter((l) => !modules.some((m) => m.lessons.some((x) => x.id === l.id))).length;
    if (removed && edit.students && !(await confirmDialog({ title: `You removed ${removed} ${removed === 1 ? "lesson" : "lessons"}`, body: `Learners lose their progress, notes and resources for ${removed === 1 ? "it" : "them"}. Save anyway?`, confirmLabel: "Save anyway", danger: true }))) return;
    setError("");
    start(async () => {
      const res = await updateCourseFull(edit.courseId, { ...fields(), status });
      if (res.error) {
        setError(res.error);
        return show(res);
      }
      setSavedSnap(snapshot);
      show(status === "published" ? "Published." : status === "draft" ? "Moved back to draft." : res.ok ?? "Changes saved.");
      router.push(`${base}/${edit.courseId}`);
    });
  }

  function create(publish: boolean) {
    setError("");
    start(async () => {
      const res = await createCourseFull({
        title,
        summary,
        description,
        skills,
        instructorId,
        categoryId,
        level,
        coverUrl,
        priceNaira: paid ? String(priceNum) : "0",
        listed,
        group: { ...group, enabled: paid && group.enabled },
        modules: lessonPayload(),
        publish,
      });
      if (res.error) {
        setError(res.error);
        return show(res);
      }
      show(res.ok ?? (publish ? "Course published." : "Course created as a draft."));
      router.push(tutor ? `${base}/${res.id}` : `${base}/${res.id}?tab=curriculum`);
    });
  }

  return (
    <>
      {toast}
      <p className="et-set-crumb">
        <Link href={base}>Courses</Link> <span>/</span>{" "}
        {edit ? <Link href={`${base}/${edit.courseId}`}>{initial?.title}</Link> : "New course"} <span>/</span> {edit ? "Edit" : STEPS[step]}
      </p>
      <div className="et-page-head">
        <div>
          <h1>{edit ? "Edit course" : "New course"}</h1>
          <p>
            {edit
              ? `Changes save automatically as you work. Use the Review step to ${tutor && !tutor.canPublish ? "submit it for review" : "publish or unpublish"}.`
              : `Set it up in four steps: details, lessons (with videos, text and files), price, then review.${tutor && !tutor.canPublish ? " The Etivio team reviews every course before it goes live." : ""}`}
          </p>
        </div>
        {edit && (
          <span className={`et-autosave is-${saveState}`} role="status" title={saveState === "error" ? saveError : undefined}>
            {saveState === "error" ? <AlertCircle size={14} /> : saveState === "saved" ? <Check size={14} /> : <CloudUpload size={14} />}
            {saveState === "error" ? `Not saved: ${saveError}` : saveState === "saved" ? "All changes saved" : "Saving…"}
          </span>
        )}
      </div>

      <ol className="et-wiz-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? "is-on" : i < step ? "is-done" : ""}>
            <button type="button" onClick={() => go(i)}>
              <span>{i < step ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      {error && <p className="et-flash et-flash-err">{error}</p>}

      <section className="et-card et-card-pad et-form et-wiz-body">
        {step === 0 && (
          <div className="et-wiz-basics">
            <div className="et-form">
              <div className="et-field">
                <label htmlFor="w-title">Course title</label>
                <input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Product design fundamentals" maxLength={140} autoFocus />
              </div>
              <button type="button" className="et-btn et-btn-ghost et-btn-sm et-ai-inline" disabled={!!aiBusy || title.trim().length < 4} onClick={aiDetails}>
                <Sparkles size={13} /> {aiBusy === "copy" ? "Writing…" : "Write the summary, description and skills with AI"}
              </button>
              <div className="et-field">
                <label htmlFor="w-summary">Short summary</label>
                <textarea id="w-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} placeholder="One or two sentences on what learners will be able to do after this course." />
                <small>{summary.length}/300</small>
              </div>
              <div className="et-form-grid">
                {!tutor && (
                <div className="et-field">
                  <label htmlFor="w-instructor">Instructor</label>
                  <Select id="w-instructor" value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                  </Select>
                </div>
                )}
                <div className="et-field">
                  <label htmlFor="w-cat">Category</label>
                  <Select id="w-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">Choose a category</option>
                    {parents.map((p) => [
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>,
                      ...categories
                        .filter((c) => c.parent_id === p.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {"    "}
                            {p.name} › {c.name}
                          </option>
                        )),
                    ])}
                  </Select>
                </div>
              </div>
              <div className="et-field">
                <label htmlFor="w-desc">About this course</label>
                <textarea id="w-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} placeholder="What's covered, who it's for, and what learners need before starting." />
              </div>
              <div className="et-field">
                <label htmlFor="w-skills">Skills learners will earn</label>
                <input id="w-skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Figma, UI design, Prototyping" />
                <small>Shown on their profile when they finish. Separate with commas, up to 12.</small>
              </div>
              <div className="et-field">
                <label>Level</label>
                <div className="et-wiz-levels" role="radiogroup" aria-label="Level">
                  {(["beginner", "intermediate", "advanced"] as Level[]).map((l) => (
                    <button key={l} type="button" role="radio" aria-checked={level === l} className={level === l ? "is-on" : ""} onClick={() => setLevel(l)}>
                      {l[0].toUpperCase() + l.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="et-field">
              <label>Cover image</label>
              {coverUrl ? (
                <div className="et-wiz-cover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverUrl} alt="" />
                  <div className="et-inline">
                    <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => cover.current?.open()}>
                      Replace
                    </button>
                    <button type="button" className="et-btn et-btn-ghost et-btn-sm et-ai-inline" disabled={!!aiBusy || title.trim().length < 4} onClick={aiMakeCover}>
                      <Sparkles size={13} /> {aiBusy === "cover" ? "Creating…" : "New AI cover"}
                    </button>
                    <button type="button" className="et-icon-btn" onClick={() => setCoverUrl("")} aria-label="Remove cover">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="et-be-drop et-wiz-drop" onClick={() => cover.current?.open()}>
                  <ImagePlus size={24} strokeWidth={1.5} />
                  <b>Add a cover image</b>
                  <small>16:9 · crop and zoom before upload</small>
                </button>
              )}
              {!coverUrl && (
                <button type="button" className="et-btn et-btn-ghost et-btn-sm et-ai-inline" disabled={!!aiBusy || title.trim().length < 4} onClick={aiMakeCover}>
                  <Sparkles size={13} /> {aiBusy === "cover" ? "Creating a cover…" : "Or generate a cover with AI"}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="et-wiz-curr">
            <p className="et-muted" style={{ fontSize: 13 }}>
              Add modules and the lessons inside them. Give each lesson a title, then click <b>Add content</b> to paste a YouTube link, write text, or attach files. Drag lessons to reorder them or move them between modules.
            </p>
            <div className="et-ai-bar">
              <button type="button" className="et-btn et-btn-ghost et-ai-inline" disabled={!!aiBusy || title.trim().length < 4} onClick={aiPlan}>
                <Sparkles size={14} /> {aiBusy === "outline" ? "Planning your course…" : "Generate outline with AI"}
              </button>
              <label className="et-check">
                <input type="checkbox" checked={aiWeb} onChange={(e) => setAiWeb(e.target.checked)} /> Research how this topic is taught online first
              </label>
            </div>
            {modules.map((m, mi) => (
              <div key={m.key} className="et-wiz-mod">
                <div className="et-wiz-mod-head">
                  <span className="et-wiz-num">{mi + 1}</span>
                  <input className="et-input" value={m.title} onChange={(e) => setMod(mi, { title: e.target.value })} placeholder="Module title" aria-label={`Module ${mi + 1} title`} />
                  <button type="button" className="et-icon-btn is-danger" disabled={modules.length === 1} onClick={() => setModules((ms) => ms.filter((_, i) => i !== mi))} aria-label="Remove module">
                    <Trash2 size={14} />
                  </button>
                </div>
                <ul
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (drag && !m.lessons.length) moveLesson(drag, { m: mi, l: 0 });
                    setDrag(null);
                  }}
                >
                  {m.lessons.map((l, li) => (
                    <li
                      key={l.key}
                      draggable={openLesson !== l.key}
                      onDragStart={() => setDrag({ m: mi, l: li })}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation();
                        if (drag && (drag.m !== mi || drag.l !== li)) moveLesson(drag, { m: mi, l: li });
                        setDrag(null);
                      }}
                      className={`et-wiz-lesson${openLesson === l.key ? " is-open" : ""}${drag?.m === mi && drag?.l === li ? " is-drag" : ""}`}
                    >
                      <LessonCard
                        lesson={l}
                        index={li}
                        open={openLesson === l.key}
                        onToggle={() => setOpenLesson((k) => (k === l.key ? null : l.key))}
                        onChange={(patch) => setLesson(m.key, l.key, patch)}
                        onEnter={() => addLesson(mi, li + 1)}
                        ai={{ courseTitle: title, moduleTitle: m.title, level }}
                        onRemove={async () => {
                          const learners = edit?.students && l.id ? ` ${edit.students} enrolled learners lose their progress and notes on it.` : "";
                          if ((learners || l.videoUrl || hasText(l.content) || l.files.length) && !(await confirmDialog({ title: `Remove "${l.title || "this lesson"}"?`, body: `Its video, notes and files are removed too.${learners}`, confirmLabel: "Remove", danger: true }))) return;
                          setMod(mi, { lessons: m.lessons.filter((_, i) => i !== li) });
                        }}
                      />
                    </li>
                  ))}
                </ul>
                <button type="button" className="et-wiz-add" onClick={() => setOpenLesson(addLesson(mi, m.lessons.length).key)}>
                  <Plus size={13} /> Add lesson
                </button>
              </div>
            ))}
            <button type="button" className="et-btn et-btn-ghost" onClick={() => setModules((ms) => [...ms, { key: nextKey(), title: "", lessons: [newLesson()] }])}>
              <Plus size={14} /> Add module
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="et-wiz-price">
            <div className="et-wiz-choice">
              <button type="button" className={!paid ? "is-on" : ""} onClick={() => setPaid(false)}>
                <b>Free</b>
                <small>Anyone can enrol. Good for building an audience and reviews.</small>
              </button>
              <button type="button" className={paid ? "is-on" : ""} onClick={() => setPaid(true)}>
                <b>Paid</b>
                <small>Learners pay once through Paystack and keep access for good.</small>
              </button>
            </div>
            {paid && (
              <div className="et-field" style={{ maxWidth: 320 }}>
                <label htmlFor="w-price">Price (₦)</label>
                <input id="w-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 15000" autoFocus />
                <small>{tutor ? "Minimum ₦500. Your earnings are the price minus Etivio's commission." : "Minimum ₦500. The tutor's share is set in Settings › Platform."}</small>
              </div>
            )}
            {paid && (
              <div className="et-wiz-group">
                <label className="et-wiz-listed">
                  <span>
                    <b>Group buy</b>
                    <small>Let learners buy together at a discount. When the group fills in time everyone gets the course; if not, their money goes to their Etivio wallet.</small>
                  </span>
                  <input type="checkbox" role="switch" className="et-toggle" checked={group.enabled} onChange={(e) => setG({ enabled: e.target.checked })} />
                </label>
                {group.enabled && (
                  <>
                    <div className="et-form-grid et-gb-admin-grid">
                      <div className="et-field">
                        <label htmlFor="w-gsize">People per group</label>
                        <input id="w-gsize" type="number" min={2} max={50} value={group.size} onChange={(e) => setG({ size: Number(e.target.value) })} />
                      </div>
                      <div className="et-field">
                        <label htmlFor="w-gdisc">Discount (%)</label>
                        <input id="w-gdisc" type="number" min={10} max={40} value={group.discount} onChange={(e) => setG({ discount: Number(e.target.value) })} />
                      </div>
                      <div className="et-field">
                        <label htmlFor="w-gdays">Days to fill</label>
                        <input id="w-gdays" type="number" min={1} max={30} value={group.days} onChange={(e) => setG({ days: Number(e.target.value) })} />
                      </div>
                    </div>
                    {priceNum >= 500 && group.discount >= 10 && group.discount <= 40 && (
                      <small className="et-muted">
                        Each member pays ₦{Math.round((priceNum * (100 - group.discount)) / 100).toLocaleString()} instead of ₦{priceNum.toLocaleString()}.
                      </small>
                    )}
                  </>
                )}
              </div>
            )}
            <label className="et-wiz-listed">
              <span>
                <b>Show on the marketplace</b>
                <small>List this course on Explore once it&apos;s published. When off, it&apos;s still reachable from its own page and Browse.</small>
              </span>
              <input type="checkbox" role="switch" className="et-toggle" checked={listed} onChange={(e) => setListed(e.target.checked)} />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="et-wiz-review">
            <div className="et-wiz-summary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {coverUrl ? <img src={coverUrl} alt="" /> : <span className="et-wiz-nocover">No cover</span>}
              <dl className="et-kv">
                <dt>Title</dt>
                <dd>{title}</dd>
                <dt>Instructor</dt>
                <dd>{instructors.find((i) => i.id === instructorId)?.label}</dd>
                <dt>Category</dt>
                <dd>{catLabel}</dd>
                <dt>Level</dt>
                <dd style={{ textTransform: "capitalize" }}>{level}</dd>
                <dt>Price</dt>
                <dd>
                  {paid ? `₦${priceNum.toLocaleString()}` : "Free"}
                  {paid && group.enabled ? ` · group buy ${group.discount}% off for ${group.size} people` : ""}
                </dd>
                <dt>Curriculum</dt>
                <dd>
                  {modules.filter((m) => m.title.trim()).length} modules · {lessonTotal} lessons
                </dd>
              </dl>
            </div>
            {!lessonTotal && <p className="et-flash et-flash-warn">There are no lessons yet, so this can only be saved as a draft. Add lesson titles in step 2 to {tutor && !tutor.canPublish ? "submit it" : "publish"}.</p>}
            {edit && (
              <p className="et-muted" style={{ fontSize: 12.5 }}>
                Status now: <b>{COURSE_STATUS_LABEL[edit.status]}</b>
                {edit.students ? ` · ${edit.students} enrolled learners keep their progress on lessons you keep.` : ""}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="et-wiz-foot">
        {step > 0 ? (
          <button type="button" className="et-btn et-btn-ghost" onClick={() => go(step - 1)} disabled={saving}>
            <ArrowLeft size={14} /> Back
          </button>
        ) : (
          <Link href={edit ? `${base}/${edit.courseId}` : base} className="et-btn et-btn-ghost">
            {edit ? "Back to course" : "Cancel"}
          </Link>
        )}
        {step < 3 ? (
          <button type="button" className="et-btn et-btn-primary" onClick={() => go(step + 1)}>
            Continue <ArrowRight size={14} />
          </button>
        ) : (
          edit ? (
            <div className="et-inline">
              {edit.status === "published" ? (
                <button type="button" className="et-btn et-btn-ghost" onClick={() => saveEdit("draft")} disabled={saving}>
                  Unpublish
                </button>
              ) : tutor && edit.status === "pending" ? (
                <span className="et-muted" style={{ fontSize: 13 }}>Waiting for review</span>
              ) : tutor && !tutor.canPublish ? (
                <button type="button" className="et-btn et-btn-success" onClick={() => saveEdit("pending")} disabled={saving || !lessonTotal}>
                  {saving ? "Submitting…" : "Submit for review"}
                </button>
              ) : (
                <button type="button" className="et-btn et-btn-success" onClick={() => saveEdit("published")} disabled={saving || !lessonTotal}>
                  {saving ? "Publishing…" : "Publish"}
                </button>
              )}
              <button type="button" className="et-btn et-btn-primary" onClick={() => saveEdit("keep")} disabled={saving}>
                {saving ? "Saving…" : "Done"}
              </button>
            </div>
          ) : (
          <div className="et-inline">
            <button type="button" className="et-btn et-btn-ghost" onClick={() => create(false)} disabled={saving}>
              {saving ? "Creating…" : "Save as draft"}
            </button>
            <button type="button" className="et-btn et-btn-success" onClick={() => create(true)} disabled={saving || !lessonTotal}>
              {saving ? "Creating…" : tutor && !tutor.canPublish ? "Submit for review" : "Create and publish"}
            </button>
          </div>
          )
        )}
      </div>

      <CropUpload
        ref={cover}
        title="Course cover"
        hint="Shown on course cards and the course page. 16:9 works best."
        out={{ width: 1600, height: 900 }}
        kind="cover"
        confirmLabel="Use this image"
        onUploaded={async (url) => {
          setCoverUrl(url);
          return undefined;
        }}
      />
    </>
  );
}
