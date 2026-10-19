"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, GripVertical, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { CropUpload, type CropUploadHandle } from "@/components/dash/CropUpload";
import { useToast } from "@/components/dash/useToast";
import type { Category } from "@/components/dash/CategoryManager";
import { createCourseFull } from "../actions";

type Level = "beginner" | "intermediate" | "advanced";
type Mod = { key: number; title: string; lessons: { key: number; title: string }[] };
const STEPS = ["Basics", "Curriculum", "Pricing", "Review"] as const;
let uid = 0;
const nextKey = () => ++uid;

// Four steps: basics, curriculum outline, pricing, then review and create (as a draft or published).
export function CourseWizard({ instructors, categories, defaultInstructor }: { instructors: { id: string; label: string }[]; categories: Category[]; defaultInstructor: string }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [saving, start] = useTransition();
  const cover = useRef<CropUploadHandle>(null);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [instructorId, setInstructorId] = useState(instructors.some((i) => i.id === defaultInstructor) ? defaultInstructor : (instructors[0]?.id ?? ""));
  const [categoryId, setCategoryId] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [coverUrl, setCoverUrl] = useState("");
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState("");
  const [modules, setModules] = useState<Mod[]>([{ key: nextKey(), title: "Getting started", lessons: [{ key: nextKey(), title: "" }] }]);
  const [drag, setDrag] = useState<{ m: number; l: number } | null>(null);
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
  const setLesson = (mi: number, li: number, t: string) => setMod(mi, { lessons: modules[mi].lessons.map((l, i) => (i === li ? { ...l, title: t } : l)) });
  const moveLesson = (from: { m: number; l: number }, to: { m: number; l: number }) =>
    setModules((ms) => {
      const copy = ms.map((m) => ({ ...m, lessons: [...m.lessons] }));
      const [item] = copy[from.m].lessons.splice(from.l, 1);
      copy[to.m].lessons.splice(to.l, 0, item);
      return copy;
    });

  function create(publish: boolean) {
    setError("");
    start(async () => {
      const res = await createCourseFull({
        title,
        summary,
        instructorId,
        categoryId,
        level,
        coverUrl,
        priceNaira: paid ? String(priceNum) : "0",
        modules: modules.map((m) => ({ title: m.title, lessons: m.lessons.map((l) => l.title) })),
        publish,
      });
      if (res.error) {
        setError(res.error);
        return show(res);
      }
      show(publish ? "Course published." : "Course created as a draft.");
      router.push(`/admin/courses/${res.id}?tab=curriculum`);
    });
  }

  return (
    <>
      {toast}
      <p className="et-set-crumb">
        <Link href="/admin/courses">Courses</Link> <span>/</span> New course <span>/</span> {STEPS[step]}
      </p>
      <div className="et-page-head">
        <div>
          <h1>New course</h1>
          <p>Set it up in four steps. You can add videos, quizzes and documents after it&apos;s created.</p>
        </div>
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
              <div className="et-field">
                <label htmlFor="w-summary">Short summary</label>
                <textarea id="w-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} placeholder="One or two sentences on what learners will be able to do after this course." />
                <small>{summary.length}/300</small>
              </div>
              <div className="et-form-grid">
                <div className="et-field">
                  <label htmlFor="w-instructor">Instructor</label>
                  <select id="w-instructor" value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="et-field">
                  <label htmlFor="w-cat">Category</label>
                  <select id="w-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
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
                  </select>
                </div>
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
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="et-wiz-curr">
            <p className="et-muted" style={{ fontSize: 13 }}>
              Outline the course: modules, and the lessons inside them. Just titles for now. Drag lessons to reorder or move them between modules. You&apos;ll add videos and text on the next screen.
            </p>
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
                      draggable
                      onDragStart={() => setDrag({ m: mi, l: li })}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation();
                        if (drag && (drag.m !== mi || drag.l !== li)) moveLesson(drag, { m: mi, l: li });
                        setDrag(null);
                      }}
                      className={drag?.m === mi && drag?.l === li ? "is-drag" : ""}
                    >
                      <GripVertical size={14} className="et-wiz-grip" />
                      <input
                        className="et-input"
                        value={l.title}
                        onChange={(e) => setLesson(mi, li, e.target.value)}
                        placeholder={`Lesson ${li + 1} title`}
                        aria-label={`Lesson ${li + 1} title`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setMod(mi, { lessons: [...m.lessons.slice(0, li + 1), { key: nextKey(), title: "" }, ...m.lessons.slice(li + 1)] });
                          }
                        }}
                      />
                      <button type="button" className="et-icon-btn" onClick={() => setMod(mi, { lessons: m.lessons.filter((_, i) => i !== li) })} aria-label="Remove lesson">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="et-wiz-add" onClick={() => setMod(mi, { lessons: [...m.lessons, { key: nextKey(), title: "" }] })}>
                  <Plus size={13} /> Add lesson
                </button>
              </div>
            ))}
            <button type="button" className="et-btn et-btn-ghost" onClick={() => setModules((ms) => [...ms, { key: nextKey(), title: "", lessons: [{ key: nextKey(), title: "" }] }])}>
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
                <small>Minimum ₦500. The tutor&apos;s share is set in Settings › Platform.</small>
              </div>
            )}
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
                <dd>{paid ? `₦${priceNum.toLocaleString()}` : "Free"}</dd>
                <dt>Curriculum</dt>
                <dd>
                  {modules.filter((m) => m.title.trim()).length} modules · {lessonTotal} lessons
                </dd>
              </dl>
            </div>
            {!lessonTotal && <p className="et-flash et-flash-warn">There are no lessons yet, so this can only be saved as a draft. Add lesson titles in step 2 to publish now.</p>}
          </div>
        )}
      </section>

      <div className="et-wiz-foot">
        {step > 0 ? (
          <button type="button" className="et-btn et-btn-ghost" onClick={() => go(step - 1)} disabled={saving}>
            <ArrowLeft size={14} /> Back
          </button>
        ) : (
          <Link href="/admin/courses" className="et-btn et-btn-ghost">
            Cancel
          </Link>
        )}
        {step < 3 ? (
          <button type="button" className="et-btn et-btn-primary" onClick={() => go(step + 1)}>
            Continue <ArrowRight size={14} />
          </button>
        ) : (
          <div className="et-inline">
            <button type="button" className="et-btn et-btn-ghost" onClick={() => create(false)} disabled={saving}>
              {saving ? "Creating…" : "Save as draft"}
            </button>
            <button type="button" className="et-btn et-btn-success" onClick={() => create(true)} disabled={saving || !lessonTotal}>
              {saving ? "Creating…" : "Create and publish"}
            </button>
          </div>
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
