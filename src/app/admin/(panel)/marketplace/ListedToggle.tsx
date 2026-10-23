"use client";
import { useTransition } from "react";
import { setCourseListed } from "./actions";
import { alertDialog } from "@/components/dash/dialogs";

// Flips a course on or off the marketplace as soon as it's clicked.
export function ListedToggle({ id, listed, title }: { id: string; listed: boolean; title: string }) {
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      role="switch"
      className="et-toggle"
      aria-label={`Show ${title} on the marketplace`}
      defaultChecked={listed}
      disabled={pending}
      onChange={(e) => {
        const next = e.currentTarget.checked;
        start(async () => {
          const res = await setCourseListed(id, next);
          if (res.error) alertDialog({ title: "Couldn't update the listing", body: res.error });
        });
      }}
    />
  );
}
