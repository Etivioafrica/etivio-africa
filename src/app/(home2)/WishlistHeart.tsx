"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleSaved } from "@/app/(app)/learn/actions";

// Heart on homepage course cards. Saves the course to the learner's Saved list;
// signed-out visitors are sent to sign in by the server action.
export function WishlistHeart({ courseId, title }: { courseId: string; title: string }) {
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className={`et-h2-heart${saved ? " is-on" : ""}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title} for later`}
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("courseId", courseId);
        fd.set("saved", saved ? "1" : "0");
        setSaved(!saved);
        start(async () => {
          try {
            await toggleSaved(fd);
          } catch (e) {
            setSaved(saved);
            throw e;
          }
        });
      }}
    >
      <Heart size={17} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
