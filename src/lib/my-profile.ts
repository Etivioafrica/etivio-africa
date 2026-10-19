import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// The signed-in user's private profile fields (account status, preferences, welcome-guide answers).
// Profiles only expose public columns to clients; this goes through my_profile(), which returns the caller's row only.
export const getMyPrivateProfile = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_profile").maybeSingle();
  return data;
});
