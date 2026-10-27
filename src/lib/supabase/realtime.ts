"use client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Opens a Realtime channel as the signed-in person. Database changes are filtered by row level security, so the
// channel must carry their sign-in; subscribing before the session has loaded joins as anonymous and every private
// row (support replies, messages, notifications) is silently dropped. `build` adds the listeners and subscribes.
// Returns the cleanup for useEffect.
export function listen(build: (supabase: SupabaseClient) => RealtimeChannel) {
  const supabase = createClient();
  let channel: RealtimeChannel | null = null;
  let gone = false;
  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (gone) return;
    await supabase.realtime.setAuth(data.session?.access_token ?? null);
    if (gone) return;
    channel = build(supabase);
  })();
  return () => {
    gone = true;
    if (channel) supabase.removeChannel(channel);
  };
}
