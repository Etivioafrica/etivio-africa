"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUnseenBadges, markBadgesSeen } from "@/app/(app)/actions";
import { BADGE_INFO, type BadgeId } from "@/lib/badges";
import { BadgeSeal } from "./Badges";
import { CELEBRATE_EVENT } from "./ReplayBadge";

const CONFETTI = ["#2563eb", "#c026d3", "#f59e0b", "#0f766e", "#ea580c", "#f9c6d3", "#5eead4"];

// "You earned a badge" modal. Checks for uncelebrated badges on every navigation, and whenever the server
// layout reports new ones (`trigger`, e.g. after marking a lesson done without leaving the page).
export function BadgeCelebration({ trigger }: { trigger: string }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [badges, setBadges] = useState<BadgeId[]>([]);
  // A replay (clicking an earned badge) doesn't count as seeing it for the first time.
  const [replay, setReplay] = useState(false);

  useEffect(() => {
    const onReplay = (e: Event) => {
      const ids = (e as CustomEvent<BadgeId[]>).detail;
      if (!ids?.length || dialog.current?.open) return;
      setReplay(true);
      setBadges(ids);
      dialog.current?.showModal();
    };
    window.addEventListener(CELEBRATE_EVENT, onReplay);
    return () => window.removeEventListener(CELEBRATE_EVENT, onReplay);
  }, []);

  useEffect(() => {
    let live = true;
    getUnseenBadges().then((ids) => {
      if (!live || !ids.length || dialog.current?.open) return;
      setReplay(false);
      setBadges(ids);
      dialog.current?.showModal();
    });
    return () => {
      live = false;
    };
  }, [pathname, trigger]);

  function close() {
    dialog.current?.close();
    if (badges.length && !replay) markBadgesSeen(badges);
    setBadges([]);
  }

  const first = badges[0] ? BADGE_INFO[badges[0]] : null;
  return (
    <dialog
      ref={dialog}
      className="et-modal et-modal-sm et-celebrate"
      aria-labelledby="celebrate-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === dialog.current && close()}
    >
      {first && (
        <>
          <div className="et-confetti" aria-hidden="true">
            {Array.from({ length: 36 }, (_, i) => (
              <i
                key={i}
                style={{
                  left: `${(i * 37) % 100}%`,
                  background: CONFETTI[i % CONFETTI.length],
                  animationDelay: `${(i % 9) * 0.07}s`,
                  animationDuration: `${1.6 + (i % 5) * 0.25}s`,
                  ["--spin" as string]: `${(i % 2 ? 1 : -1) * (180 + i * 23)}deg`,
                }}
              />
            ))}
          </div>
          <div className="et-celebrate-seals">
            {badges.map((id) => (
              <BadgeSeal key={id} id={id} size={badges.length > 1 ? 120 : 168} />
            ))}
          </div>
          <p className="et-celebrate-kicker">Congratulations!</p>
          <h2 id="celebrate-title">{badges.length > 1 ? `You earned ${badges.length} new badges` : `You earned the ${first.label} badge`}</h2>
          <p className="et-celebrate-sub">
            {badges.length > 1 ? badges.map((id) => BADGE_INFO[id].label).join(" · ") : `${first.hint}. Keep going, there are more to unlock.`}
          </p>
          <div className="et-celebrate-actions">
            <button type="button" className="et-btn et-btn-ghost" onClick={close}>
              Keep learning
            </button>
            <Link href="/profile/badges" className="et-btn et-btn-primary" onClick={close}>
              View my badges
            </Link>
          </div>
        </>
      )}
    </dialog>
  );
}
