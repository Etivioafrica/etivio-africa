"use client";
import { useEffect, useRef, useState } from "react";

// A text input or textarea that shows how much of its character limit is used, so nobody has to guess why typing
// stopped. The count turns amber near the limit and says so when it is reached. Uncontrolled: the form still submits it.
export function CountedField({
  as = "input",
  id,
  name,
  max,
  defaultValue = "",
  rows,
  placeholder,
  autoComplete,
}: {
  as?: "input" | "textarea";
  id: string;
  name: string;
  max: number;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "url" | "text";
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [count, setCount] = useState(defaultValue.length);

  // Cancel / reset buttons restore the saved value without firing an input event.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onReset = () => setTimeout(() => setCount(ref.current?.value.length ?? 0), 0);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const left = max - count;
  // Saved text can be longer than a limit introduced later: say how far over it is instead of "0 left".
  const state = left <= 0 ? "is-full" : left <= Math.max(10, Math.round(max * 0.1)) ? "is-near" : "";
  const shared = { id, name, defaultValue, maxLength: max, placeholder, autoComplete, onInput: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => setCount(e.currentTarget.value.length), "aria-describedby": `${id}-count` };
  return (
    <>
      {as === "textarea" ? <textarea ref={ref} rows={rows} {...shared} /> : <input ref={ref} {...shared} />}
      <small id={`${id}-count`} className={`et-count-hint ${state}`} aria-live="polite">
        {left < 0 ? `${(-left).toLocaleString()} over the ${max.toLocaleString()}-character limit` : left === 0 ? `Limit reached: ${max.toLocaleString()} characters` : `${count.toLocaleString()} / ${max.toLocaleString()} characters`}
      </small>
    </>
  );
}
