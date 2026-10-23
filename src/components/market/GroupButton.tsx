"use client";
import { useActionState } from "react";
import { Users } from "lucide-react";
import { joinGroup, startGroup, type GroupActionState } from "@/app/(public)/groups/actions";

// "Start a group" (course page) or "Join this group" (group page). Both go on to pay at the group price.
export function GroupButton({ mode, courseId, code, label }: { mode: "start" | "join"; courseId?: string; code?: string; label: string }) {
  const [state, action, pending] = useActionState<GroupActionState, FormData>(mode === "start" ? startGroup : joinGroup, null);
  return (
    <form action={action} className="et-gb-form">
      {courseId && <input type="hidden" name="course_id" value={courseId} />}
      {code && <input type="hidden" name="code" value={code} />}
      <button type="submit" className={`et-btn ${mode === "join" ? "et-btn-primary" : "et-ud-outline"} et-ud-cta`} disabled={pending}>
        <Users size={16} /> {pending ? "Opening payment…" : label}
      </button>
      {state?.error && <p className="et-gb-error">{state.error}</p>}
    </form>
  );
}
