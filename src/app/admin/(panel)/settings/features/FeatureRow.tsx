"use client";
import { useState, useTransition } from "react";
import { useToast } from "@/components/dash/useToast";
import type { FeatureStatus } from "@/lib/features";
import { setFeature } from "./actions";

const OPTIONS: { value: FeatureStatus; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "staff", label: "Admins only" },
  { value: "on", label: "Everyone" },
];

export function FeatureRow({ id, label, description, status }: { id: string; label: string; description: string; status: FeatureStatus }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const [toast, show] = useToast();
  return (
    <div className="et-ff-row">
      {toast}
      <div className="et-ff-text">
        <b>
          {label} <span className={`et-ff-dot is-${value}`} aria-hidden />
        </b>
        <small>{description}</small>
      </div>
      <div className="et-seg" role="radiogroup" aria-label={label}>
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? "is-on" : ""}
            disabled={pending}
            onClick={() => {
              if (o.value === value) return;
              const before = value;
              setValue(o.value);
              start(async () => {
                const res = await setFeature(id, o.value);
                if (res.error) setValue(before);
                show(res);
              });
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
