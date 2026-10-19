"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { checkUsername, claimUsername, type UsernameCheck } from "./actions";

// Type a username, see live availability and suggestions, then confirm to claim it.
// Saves on its own, separate from the rest of the My details form.
export function UsernamePicker({ current }: { current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const [check, setCheck] = useState<UsernameCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, startSaving] = useTransition();
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  const seq = useRef(0);

  // Debounced lookup. `seq` drops responses that arrive after a newer keystroke.
  useEffect(() => {
    const id = ++seq.current;
    const t = setTimeout(
      async () => {
        setChecking(true);
        const res = await checkUsername(value);
        if (id !== seq.current) return;
        setCheck(res);
        setChecking(false);
      },
      value ? 400 : 0,
    );
    return () => clearTimeout(t);
  }, [value]);

  function edit(next: string) {
    setResult(null);
    setConfirming(false);
    setValue(next.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30));
  }

  function claim() {
    if (!check || check.status !== "available") return;
    const name = check.name;
    startSaving(async () => {
      const res = await claimUsername(name);
      setResult(res);
      setConfirming(false);
      if (res.ok) setCheck({ name, status: "current", message: "This is your current username.", suggestions: [] });
    });
  }

  const status = checking ? "checking" : check?.status;
  const showSuggestions = !checking && check && check.suggestions.length > 0 && check.status !== "available";

  return (
    <div className="et-field">
      <label htmlFor="username">Username</label>
      <div className={`et-prefix et-uname is-${status ?? "idle"}`}>
        <span>etivio.co/@</span>
        <input
          id="username"
          value={value}
          onChange={(e) => edit(e.target.value)}
          placeholder="yourname"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="username-status"
        />
        <i aria-hidden="true">
          {status === "checking" && <Loader2 size={15} className="et-spin" />}
          {(status === "available" || status === "current") && <Check size={15} />}
          {(status === "taken" || status === "invalid") && <X size={15} />}
        </i>
      </div>

      <small id="username-status" className={`et-uname-msg is-${status ?? "idle"}`} aria-live="polite">
        {result?.ok ?? result?.error ?? (checking ? "Checking…" : check?.message || "3 to 30 characters: lowercase letters, numbers, and underscores.")}
      </small>

      {showSuggestions && (
        <div className="et-uname-suggest">
          <span>{check!.status === "empty" ? "Suggestions:" : "Available:"}</span>
          {check!.suggestions.map((s) => (
            <button key={s} type="button" className="et-chip" onClick={() => edit(s)}>
              @{s}
            </button>
          ))}
        </div>
      )}

      {status === "available" &&
        (confirming ? (
          <div className="et-uname-confirm">
            <p>
              Use <b>etivio.co/@{check!.name}</b> as your profile link?
              {current && <> Your old link @{current} will stop working.</>}
            </p>
            <div className="et-inline">
              <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={claim} disabled={saving}>
                {saving ? "Saving…" : "Yes, use it"}
              </button>
              <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => setConfirming(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button type="button" className="et-btn et-btn-primary et-btn-sm" onClick={() => setConfirming(true)}>
              Claim @{check!.name}
            </button>
          </div>
        ))}
    </div>
  );
}
