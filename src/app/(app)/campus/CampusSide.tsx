"use client";
import { useActionState, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { joinCommunity } from "../communities/actions";

// How many people have Campus open right now (Realtime presence, one entry per person).
export function OnlineNow({ viewerId }: { viewerId: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("campus-online", { config: { presence: { key: viewerId } } });
    channel
      .on("presence", { event: "sync" }, () => setCount(Object.keys(channel.presenceState()).length))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ since: new Date().toISOString() });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewerId]);
  if (count === null) return null;
  return (
    <small className="et-cps-online">
      <i aria-hidden="true" /> {count.toLocaleString()} online
    </small>
  );
}

// Join an open community straight from Campus.
export function JoinCommunity({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(joinCommunity, null);
  if (state?.ok)
    return (
      <span className="et-cps-joined">
        <Check size={14} /> Joined
      </span>
    );
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <button type="submit" className="et-cps-join" disabled={pending} title={state?.error}>
        {pending ? <Loader2 size={14} className="et-spin" /> : "Join"}
      </button>
    </form>
  );
}
