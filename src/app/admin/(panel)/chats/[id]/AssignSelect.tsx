"use client";
import { Select } from "@/components/dash/Select";
import { assignThread } from "../actions";

// Assigns as soon as a teammate is picked.
export function AssignSelect({ id, value, staff }: { id: string; value: string; staff: { id: string; name: string }[] }) {
  return (
    <form action={assignThread} className="et-chat-assign">
      <input type="hidden" name="id" value={id} />
      <Select name="assignee" defaultValue={value} className="et-sel-sm" aria-label="Assign to" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="">Unassigned</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </form>
  );
}
