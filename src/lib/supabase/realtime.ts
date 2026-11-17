"use client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// How long a tab can sit in the background before a pausable channel is closed. Long enough that flicking between
// tabs doesn't reconnect every time.
const HIDDEN_GRACE_MS = 60_000;

type Options = {
  // Close the channel while the tab is hidden, so background tabs don't hold one of the project's Realtime
  // connections. Changes made meanwhile are missed, so `onResume` runs when the tab is visible again and the channel
  // reopens: use it to reload whatever the channel keeps fresh.
  pauseWhenHidden?: boolean;
  onResume?: () => void;
};

// Opens a Realtime channel as the signed-in person. Database changes are filtered by row level security, so the
// channel must carry their sign-in; subscribing before the session has loaded joins as anonymous and every private
// row (support replies, messages, notifications) is silently dropped. `build` adds the listeners and subscribes.
// Returns the cleanup for useEffect.
export function listen(build: (supabase: SupabaseClient) => RealtimeChannel, options: Options = {}) {
  const supabase = createClient();
  let channel: RealtimeChannel | null = null;
  let gone = false;
  let opening = false;
  let paused = false;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const open = async () => {
    if (channel || opening || gone) return;
    opening = true;
    const { data } = await supabase.auth.getSession();
    if (!gone) await supabase.realtime.setAuth(data.session?.access_token ?? null);
    opening = false;
    if (gone || paused) return;
    channel = build(supabase);
  };

  const close = () => {
    if (channel) supabase.removeChannel(channel);
    channel = null;
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      if (!hideTimer)
        hideTimer = setTimeout(() => {
          hideTimer = null;
          paused = true;
          close();
        }, HIDDEN_GRACE_MS);
      return;
    }
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    if (!paused) return;
    paused = false;
    void open();
    options.onResume?.();
  };

  void open();
  if (options.pauseWhenHidden) document.addEventListener("visibilitychange", onVisibility);
  return () => {
    gone = true;
    if (hideTimer) clearTimeout(hideTimer);
    if (options.pauseWhenHidden) document.removeEventListener("visibilitychange", onVisibility);
    close();
  };
}
