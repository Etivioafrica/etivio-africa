"use server";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAGE_TIPS, readGuide, type GuideState } from "@/lib/guide";

// Saves progress through the learner guides. guide_state has no client grants, so this checks who's signed in and
// writes with the service role. Only the known keys are accepted.
export async function updateGuide(patch: { tour?: "done"; checklistHidden?: boolean; tip?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const db = createAdminClient();
  const { data } = await db.from("profiles").select("guide_state").eq("id", user.id).maybeSingle();
  const state: GuideState = { ...readGuide(data?.guide_state) };
  if (patch.tour === "done") state.tour = new Date().toISOString();
  if (typeof patch.checklistHidden === "boolean") state.checklist_hidden = patch.checklistHidden;
  if (patch.tip && patch.tip in PAGE_TIPS) state.tips = [...new Set([...(state.tips ?? []), patch.tip])];
  await db.from("profiles").update({ guide_state: state }).eq("id", user.id);
  // Ticks "Take the tour" on the dashboard checklist and lets page tips start showing.
  if (patch.tour) refresh();
}
