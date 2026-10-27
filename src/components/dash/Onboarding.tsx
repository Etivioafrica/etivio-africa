"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, AtSign, Check, Loader2, PartyPopper, X } from "lucide-react";
import { saveOnboarding, type OnboardingAnswers } from "@/app/(app)/actions";
import { checkUsername, claimUsername, type UsernameCheck } from "@/app/(app)/settings/actions";
import { TOPICS } from "@/lib/learner-prefs";

type Option<T extends string> = { value: T; label: string; hint?: string };

const GOALS: Option<NonNullable<OnboardingAnswers["goals"]>[number]>[] = [
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

type StepKey = "username" | "goal" | "topics" | "level" | "hours";
const QUESTIONS: StepKey[] = ["goal", "topics", "level", "hours"];

// Welcome guide for new learners: their username first, then four quick questions, shown once (finishing or
// skipping the questions marks it done). People who did the questions before usernames existed only get the
// username step. The username can't be skipped: Campus, mentions and profile links need it.
// `initial` reopens the questions later (from the account menu or Settings) with the learner's current answers.
export function Onboarding({
  name,
  askUsername,
  askQuestions,
  initial,
  onClosed,
}: {
  name: string;
  askUsername: boolean;
  askQuestions: boolean;
  initial?: OnboardingAnswers;
  onClosed: () => void;
}) {
  const updating = Boolean(initial);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const steps: StepKey[] = [...(askUsername ? (["username"] as StepKey[]) : []), ...(askQuestions ? QUESTIONS : [])];
  const STEPS = steps.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initial ?? { interests: [] });
  const [handle, setHandle] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const first = name.split(" ")[0];
  const key = steps[step];
  const onUsername = key === "username";

  // Open once, as soon as the dialog is in the page. Stable identity so re-renders don't reopen it after closing.
  const attach = useCallback((el: HTMLDialogElement | null) => {
    dialog.current = el;
    if (el && !el.open) el.showModal();
  }, []);

  // Skipping the questions still marks the guide done. Not allowed while the username is missing.
  function skip() {
    if (onUsername) return;
    dialog.current?.close();
    if (askQuestions && !updating) startSaving(() => saveOnboarding(null));
  }

  function finish() {
    startSaving(async () => {
      if (askQuestions) await saveOnboarding(answers, updating);
      setStep(STEPS);
    });
  }

  const set = (patch: Partial<OnboardingAnswers>) => setAnswers((a) => ({ ...a, ...patch }));
  const canContinue =
    key === "goal" ? (answers.goals?.length ?? 0) > 0 : key === "topics" ? (answers.interests?.length ?? 0) > 0 : key === "level" ? Boolean(answers.level) : key === "hours" ? Boolean(answers.hours) : true;

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
        {!onUsername && (
          <button type="button" className="et-icon-btn" onClick={step < STEPS ? skip : () => dialog.current?.close()} aria-label="Close" disabled={saving}>
            <X size={16} />
          </button>
        )}
      </div>

      <div className="et-ob-body">
        {onUsername && (
          <UsernameStep
            first={first}
            name={name}
            onClaimed={(u) => {
              setHandle(u);
              if (step + 1 < STEPS) setStep(step + 1);
              else setStep(STEPS);
            }}
          />
        )}
        {key === "goal" && (
          <>
            {!askUsername && <p className="et-ob-kicker">{updating ? "Update your learning goals" : `Welcome to Etivio, ${first}`}</p>}
            <h2 id="ob-title">What brings you to Etivio?</h2>
            <p className="et-ob-sub">Pick all that apply. We&apos;ll use them to personalise your learning.</p>
            <div className="et-ob-options" role="group" aria-label="Your goals">
              {GOALS.map((o) => {
                const on = answers.goals?.includes(o.value) ?? false;
                return (
                  <label key={o.value} className={`et-ob-option${on ? " is-on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => set({ goals: on ? answers.goals!.filter((g) => g !== o.value) : [...(answers.goals ?? []), o.value] })}
                    />
                    <span className="et-ob-radio et-ob-box">{on && <Check size={12} strokeWidth={3} />}</span>
                    <span>
                      <b>{o.label}</b>
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}
        {key === "topics" && (
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
        {key === "level" && (
          <>
            <h2 id="ob-title">What&apos;s your current skill level?</h2>
            <p className="et-ob-sub">We&apos;ll recommend courses that match your experience.</p>
            {radios(LEVELS, answers.level, (level) => set({ level }), "level")}
          </>
        )}
        {key === "hours" && (
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
            <h2 id="ob-title">{updating ? "Saved" : <>You&apos;re all set, {first}!</>}</h2>
            <p className="et-ob-sub">
              {updating ? "Your course suggestions and weekly goal now follow your new answers." : askQuestions ? "Your weekly goal is ready. Pick your first course and start learning." : "Your profile link is ready. Say hello on Campus."}
              {handle && (
                <>
                  {" "}
                  Your profile is <b>etivio.co/@{handle}</b>.
                </>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="et-modal-foot" hidden={onUsername}>
        {key === "goal" && (
          <button type="button" className="et-btn et-btn-ghost" onClick={skip} disabled={saving} style={{ marginRight: "auto" }}>
            {updating ? "Cancel" : "Skip for now"}
          </button>
        )}
        {step > 0 && step < STEPS && steps[step - 1] !== "username" && (
          <button type="button" className="et-btn et-btn-ghost" onClick={() => setStep(step - 1)} disabled={saving} style={{ marginRight: "auto" }}>
            Previous
          </button>
        )}
        {!onUsername && step < STEPS - 1 && (
          <button type="button" className="et-btn et-btn-primary" onClick={() => setStep(step + 1)} disabled={!canContinue}>
            Continue <ArrowRight size={15} />
          </button>
        )}
        {!onUsername && step === STEPS - 1 && (
          <button type="button" className="et-btn et-btn-primary" onClick={finish} disabled={!canContinue || saving}>
            {saving ? "Saving…" : updating ? "Save" : "Finish"}
          </button>
        )}
        {step === STEPS && (
          <>
            <button type="button" className="et-btn et-btn-ghost" onClick={() => dialog.current?.close()}>
              Go to dashboard
            </button>
            {askQuestions ? (
              <Link href="/learn/browse" className="et-btn et-btn-primary" onClick={() => dialog.current?.close()}>
                Find a course <ArrowRight size={15} />
              </Link>
            ) : (
              <Link href="/campus" className="et-btn et-btn-primary" onClick={() => dialog.current?.close()}>
                Go to Campus <ArrowRight size={15} />
              </Link>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

// Step 1: pick a username. Starts with a suggestion from their name, checks as they type, offers free alternatives.
function UsernameStep({ first, name, onClaimed }: { first: string; name: string; onClaimed: (username: string) => void }) {
  const [value, setValue] = useState("");
  const [check, setCheck] = useState<UsernameCheck | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, startSaving] = useTransition();
  const seq = useRef(0);
  const touched = useRef(false);

  // Debounced lookup; the first one (empty box) brings suggestions, and the best one fills the box.
  useEffect(() => {
    const id = ++seq.current;
    const t = setTimeout(
      async () => {
        setChecking(true);
        let res: UsernameCheck;
        try {
          res = await checkUsername(value);
        } catch {
          // Offline or the server didn't answer: say so, and let them retry by typing or tapping Continue.
          if (id !== seq.current) return;
          setChecking(false);
          setError("We couldn't check that just now. Check your connection and try again.");
          return;
        }
        if (id !== seq.current) return;
        if (!value && !touched.current && res.suggestions[0]) {
          setValue(res.suggestions[0]);
          return;
        }
        setCheck(res);
        setChecking(false);
      },
      value ? 350 : 0,
    );
    return () => clearTimeout(t);
  }, [value, retry]);

  function edit(next: string) {
    touched.current = true;
    setError("");
    setValue(next.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30));
  }

  function claim() {
    if (!check) {
      // The last check failed: run it again.
      setError("");
      setRetry((n) => n + 1);
      return;
    }
    if (check.status === "current") return onClaimed(check.name);
    if (check.status !== "available") return;
    const picked = check.name;
    startSaving(async () => {
      try {
        const res = await claimUsername(picked);
        if (res.error) return setError(res.error);
        onClaimed(picked);
      } catch {
        setError("We couldn't save it just now. Check your connection and try again.");
      }
    });
  }

  const status = checking ? "checking" : check?.status;
  const ok = status === "available" || status === "current";
  const alternatives = !checking && check && check.status !== "available" && check.status !== "current" ? check.suggestions.slice(0, 4) : [];

  return (
    <form
      className="et-ob-username"
      onSubmit={(e) => {
        e.preventDefault();
        claim();
      }}
    >
      <p className="et-ob-kicker">Welcome to Etivio, {first}</p>
      <h2 id="ob-title">Choose your username</h2>
      <p className="et-ob-sub">It&apos;s how people find and @mention you on Campus, and the link to your public profile. You can change it later in Settings.</p>
      <div className={`et-ob-handle is-${status ?? "idle"}`}>
        <AtSign size={18} />
        <input
          value={value}
          onChange={(e) => edit(e.target.value)}
          placeholder={name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "yourname"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          aria-label="Username"
          aria-describedby="ob-handle-msg"
        />
        <i aria-hidden="true">
          {status === "checking" && <Loader2 size={16} className="et-spin" />}
          {ok && <Check size={16} />}
          {(status === "taken" || status === "invalid") && <X size={16} />}
        </i>
      </div>
      <p id="ob-handle-msg" className={`et-ob-handle-msg is-${status ?? "idle"}`} aria-live="polite">
        {error || (checking ? "Checking…" : status === "available" ? `etivio.co/@${check!.name} is yours if you want it.` : check?.message || "3 to 30 characters: lowercase letters, numbers and underscores.")}
      </p>
      {alternatives.length > 0 && (
        <div className="et-ob-handle-ideas">
          <span>Try:</span>
          {alternatives.map((s) => (
            <button key={s} type="button" className="et-chip" onClick={() => edit(s)}>
              @{s}
            </button>
          ))}
        </div>
      )}
      <div className="et-ob-username-foot">
        <button type="submit" className="et-btn et-btn-primary" disabled={(!ok && !(error && !check)) || saving}>
          {saving ? "Saving…" : "Continue"} <ArrowRight size={15} />
        </button>
      </div>
    </form>
  );
}
