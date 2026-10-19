"use client";
import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, PartyPopper, X } from "lucide-react";
import { saveOnboarding, type OnboardingAnswers } from "@/app/(app)/actions";
import { TOPICS } from "@/lib/learner-prefs";

type Option<T extends string> = { value: T; label: string; hint?: string };

const GOALS: Option<NonNullable<OnboardingAnswers["goal"]>>[] = [
  { value: "new_skill", label: "Learn a new skill" },
  { value: "career", label: "Grow in my career" },
  { value: "job", label: "Get a job or switch careers" },
  { value: "freelance", label: "Find freelance work" },
  { value: "creative", label: "Explore creative interests" },
];



const LEVELS: Option<NonNullable<OnboardingAnswers["level"]>>[] = [
  { value: "beginner", label: "Beginner", hint: "I'm just getting started" },
  { value: "intermediate", label: "Intermediate", hint: "I know the basics" },
  { value: "advanced", label: "Advanced", hint: "I work with this regularly" },
  { value: "expert", label: "Expert", hint: "I could teach it" },
];

const HOURS: Option<NonNullable<OnboardingAnswers["hours"]>>[] = [
  { value: "under_3", label: "Less than 3 hours a week", hint: "We'll set a goal of 3 lessons a week" },
  { value: "3_to_6", label: "3 to 6 hours a week", hint: "We'll set a goal of 5 lessons a week" },
  { value: "over_6", label: "More than 6 hours a week", hint: "We'll set a goal of 7 lessons a week" },
];

const STEPS = 4;

// Welcome guide for new learners: four quick questions, shown once (finishing or skipping marks it done).
export function Onboarding({ name, onClosed }: { name: string; onClosed: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({ interests: [] });
  const [saving, startSaving] = useTransition();
  const first = name.split(" ")[0];

  // Open once, as soon as the dialog is in the page. Stable identity so re-renders don't reopen it after closing.
  const attach = useCallback((el: HTMLDialogElement | null) => {
    dialog.current = el;
    if (el && !el.open) el.showModal();
  }, []);

  function skip() {
    dialog.current?.close();
    startSaving(() => saveOnboarding(null));
  }

  function finish() {
    startSaving(async () => {
      await saveOnboarding(answers);
      setStep(STEPS);
    });
  }

  const set = (patch: Partial<OnboardingAnswers>) => setAnswers((a) => ({ ...a, ...patch }));
  const canContinue = [Boolean(answers.goal), (answers.interests?.length ?? 0) > 0, Boolean(answers.level), Boolean(answers.hours)][step] ?? true;

  const radios = <T extends string>(options: Option<T>[], value: T | undefined, pick: (v: T) => void, name: string) => (
    <div className="et-ob-options" role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className={`et-ob-option${value === o.value ? " is-on" : ""}`}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => pick(o.value)} />
          <span className="et-ob-radio" />
          <span>
            <b>{o.label}</b>
            {o.hint && <small>{o.hint}</small>}
          </span>
        </label>
      ))}
    </div>
  );

  return (
    <dialog
      ref={attach}
      className="et-modal et-onboarding"
      aria-labelledby="ob-title"
      onClose={() => {
        // Pick up the new weekly goal and interests on the page behind.
        router.refresh();
        onClosed();
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (step < STEPS) skip();
        else dialog.current?.close();
      }}
    >
      <div className="et-ob-top">
        {step < STEPS ? (
          <div className="et-ob-progress" aria-label={`Step ${step + 1} of ${STEPS}`}>
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} className={i <= step ? "is-on" : ""} />
            ))}
          </div>
        ) : (
          <span />
        )}
        <button type="button" className="et-icon-btn" onClick={step < STEPS ? skip : () => dialog.current?.close()} aria-label="Close" disabled={saving}>
          <X size={16} />
        </button>
      </div>

      <div className="et-ob-body">
        {step === 0 && (
          <>
            <p className="et-ob-kicker">Welcome to Etivio, {first}</p>
            <h2 id="ob-title">What brings you to Etivio?</h2>
            <p className="et-ob-sub">Help us understand your goals so we can personalise your learning.</p>
            {radios(GOALS, answers.goal, (goal) => set({ goal }), "goal")}
          </>
        )}
        {step === 1 && (
          <>
            <h2 id="ob-title">Which topics interest you?</h2>
            <p className="et-ob-sub">Pick as many as you like. We&apos;ll use them to suggest courses.</p>
            <div className="et-ob-topics">
              {TOPICS.map((t) => {
                const on = answers.interests?.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className={`et-chip${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    onClick={() => set({ interests: on ? answers.interests!.filter((x) => x !== t) : [...(answers.interests ?? []), t] })}
                  >
                    {on && <Check size={13} />} {t}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2 id="ob-title">What&apos;s your current skill level?</h2>
            <p className="et-ob-sub">We&apos;ll recommend courses that match your experience.</p>
            {radios(LEVELS, answers.level, (level) => set({ level }), "level")}
          </>
        )}
        {step === 3 && (
          <>
            <h2 id="ob-title">How much time can you give to learning?</h2>
            <p className="et-ob-sub">Set your pace. We&apos;ll turn it into a weekly goal you can change any time.</p>
            {radios(HOURS, answers.hours, (hours) => set({ hours }), "hours")}
          </>
        )}
        {step === STEPS && (
          <div className="et-ob-done">
            <span className="et-cta-icon">
              <PartyPopper size={24} />
            </span>
            <h2 id="ob-title">You&apos;re all set, {first}!</h2>
            <p className="et-ob-sub">Your weekly goal is ready. Pick your first course and start learning.</p>
          </div>
        )}
      </div>

      <div className="et-modal-foot">
        {step === 0 && (
          <button type="button" className="et-btn et-btn-ghost" onClick={skip} disabled={saving} style={{ marginRight: "auto" }}>
            Skip for now
          </button>
        )}
        {step > 0 && step < STEPS && (
          <button type="button" className="et-btn et-btn-ghost" onClick={() => setStep(step - 1)} disabled={saving} style={{ marginRight: "auto" }}>
            Previous
          </button>
        )}
        {step < STEPS - 1 && (
          <button type="button" className="et-btn et-btn-primary" onClick={() => setStep(step + 1)} disabled={!canContinue}>
            Continue <ArrowRight size={15} />
          </button>
        )}
        {step === STEPS - 1 && (
          <button type="button" className="et-btn et-btn-primary" onClick={finish} disabled={!canContinue || saving}>
            {saving ? "Saving…" : "Finish"}
          </button>
        )}
        {step === STEPS && (
          <>
            <button type="button" className="et-btn et-btn-ghost" onClick={() => dialog.current?.close()}>
              Go to dashboard
            </button>
            <Link href="/learn/browse" className="et-btn et-btn-primary" onClick={() => dialog.current?.close()}>
              Find a course <ArrowRight size={15} />
            </Link>
          </>
        )}
      </div>
    </dialog>
  );
}
