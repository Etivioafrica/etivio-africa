"use client";
import { useEffect, useState, useTransition } from "react";
import { listen } from "@/lib/supabase/realtime";
import { useRouter } from "next/navigation";
import { ArrowUp, Hand, Loader2, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CampusKind, CampusPost, FeedQuery } from "@/lib/data/campus";
import { loadMoreCampus } from "./actions";
import { OPEN_EVENT } from "./Composer";
import { KIND_STYLE } from "./kinds";
import { PostCard, type CampusViewer } from "./PostCard";

export { Composer } from "./Composer";

// Opens the composer from anywhere on the page (the starter prompts on an empty feed).
export function openCampusComposer(kind: CampusKind, text = "") {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { kind, text } }));
}

export function StarterPrompts() {
  const prompts: { kind: CampusKind; icon: LucideIcon; label: string; text: string }[] = [
    { kind: "update", icon: Hand, label: "Introduce yourself", text: "Hi Campus! I'm learning " },
    { kind: "question", icon: KIND_STYLE.question.icon, label: "Ask a question", text: "" },
    { kind: "win", icon: KIND_STYLE.win.icon, label: "Share a win", text: "" },
    { kind: "poll", icon: KIND_STYLE.poll.icon, label: "Start a poll", text: "" },
  ];
  return (
    <div className="et-cps-starters">
      {prompts.map((p) => (
        <button key={p.label} type="button" onClick={() => openCampusComposer(p.kind, p.text)}>
          <p.icon size={15} style={{ color: `var(--cps-${p.kind})` }} />
          {p.label}
        </button>
      ))}
    </div>
  );
}

// Shows "N new posts" when other people post while you're reading.
export function NewPosts({ viewerId }: { viewerId: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [pending, start] = useTransition();
  useEffect(
    () =>
      listen((supabase) =>
        supabase
          .channel("campus-feed")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "campus_posts" }, (payload) => {
            const row = payload.new as { author_id?: string; hidden?: boolean };
            if (row.author_id !== viewerId && !row.hidden) setCount((n) => n + 1);
          })
          .subscribe(),
      ),
    [viewerId],
  );
  if (!count) return null;
  return (
    <button
      type="button"
      className="et-cps-new"
      onClick={() =>
        start(() => {
          router.refresh();
          setCount(0);
          window.scrollTo({ top: 0, behavior: "smooth" });
        })
      }
    >
      {pending ? <Loader2 size={14} className="et-spin" /> : <ArrowUp size={14} />}
      Show {count} new {count === 1 ? "post" : "posts"}
    </button>
  );
}

export function FeedList({ initial, more: initialMore, viewer, query, empty }: { initial: CampusPost[]; more: boolean; viewer: CampusViewer; query: FeedQuery; empty: React.ReactNode }) {
  const [extra, setExtra] = useState<CampusPost[]>([]);
  const [more, setMore] = useState(initialMore);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const posts = [...initial, ...extra.filter((p) => !initial.some((i) => i.id === p.id))].filter((p) => !gone.has(p.id));

  function loadMore() {
    const last = posts[posts.length - 1];
    if (!last) return;
    start(async () => {
      const res = await loadMoreCampus({ ...query, before: last.createdAt });
      setExtra((e) => [...e, ...res.posts]);
      setMore(res.more);
    });
  }

  if (!posts.length) return <>{empty}</>;
  return (
    <>
      <div className="et-cps-list">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} viewer={viewer} onDeleted={() => setGone((g) => new Set(g).add(p.id))} />
        ))}
      </div>
      {more && (
        <button type="button" className="et-btn et-btn-ghost et-cps-loadmore" onClick={loadMore} disabled={pending}>
          {pending ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
