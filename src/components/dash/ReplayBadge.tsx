"use client";
import type { BadgeId } from "@/lib/badges";

export const CELEBRATE_EVENT = "etivio:celebrate";

// Wraps an earned badge so clicking it replays the congratulations modal (handled by BadgeCelebration).
export function ReplayBadge({ id, label, children }: { id: BadgeId; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="et-badge-replay"
      aria-label={`Replay the ${label} badge celebration`}
      onClick={() => window.dispatchEvent(new CustomEvent<BadgeId[]>(CELEBRATE_EVENT, { detail: [id] }))}
    >
      {children}
    </button>
  );
}
