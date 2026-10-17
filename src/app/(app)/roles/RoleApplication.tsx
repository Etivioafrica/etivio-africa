import { Clock } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { applyForRole } from "./actions";

// Apply form, or the state of the latest application for this role.
export async function RoleApplication({ userId, role, prompt }: { userId: string; role: AppRole; prompt: string }) {
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("role_applications")
    .select("status, created_at, review_note")
    .eq("user_id", userId)
    .eq("role", role)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.status === "pending")
    return (
      <p className="et-flash" style={{ background: "var(--a-panel-2)", border: "1px solid var(--a-border)", display: "flex", gap: 8, alignItems: "center" }}>
        <Clock size={15} />
        Your {ROLE_LABELS[role].toLowerCase()} application from {formatDate(latest.created_at)} is being reviewed.
      </p>
    );

  return (
    <ActionForm action={applyForRole} className="et-form" >
      {latest?.status === "rejected" && (
        <p className="et-flash et-flash-err">
          Your last application wasn&apos;t approved{latest.review_note ? `: ${latest.review_note}` : "."} You can apply again.
        </p>
      )}
      <input type="hidden" name="role" value={role} />
      <div className="et-field">
        <label htmlFor={`msg-${role}`}>{prompt}</label>
        <textarea id={`msg-${role}`} name="message" rows={4} required minLength={20} maxLength={2000} />
      </div>
      <div>
        <SubmitButton pendingLabel="Sending…">Apply to become a {ROLE_LABELS[role].toLowerCase()}</SubmitButton>
      </div>
    </ActionForm>
  );
}
