"use client";
import { updateDocument } from "./actions";

// Saves as soon as the value changes.
export function VisibilitySelect({ id, value }: { id: string; value: string }) {
  return (
    <form action={updateDocument} className="et-inline">
      <input type="hidden" name="id" value={id} />
      <select name="visibility" defaultValue={value} className="et-input" aria-label="Visibility" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="public">Public</option>
        <option value="enrolled">Enrolled students</option>
        <option value="private">Admins only</option>
      </select>
    </form>
  );
}
