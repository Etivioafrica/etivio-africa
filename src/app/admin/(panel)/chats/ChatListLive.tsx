"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { listen } from "@/lib/supabase/realtime";

// Keeps the inbox list current: any new message or status change on a thread reloads the list (and the open chat's
// header) from the server, a moment after the burst of changes settles.
export function ChatListLive() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const stop = listen((supabase) =>
      supabase
        .channel("admin-support-threads")
        .on("postgres_changes", { event: "*", schema: "public", table: "support_threads" }, () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 400);
        })
        .subscribe(),
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
      stop();
    };
  }, [router]);
  return null;
}
