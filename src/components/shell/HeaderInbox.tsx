"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Award, Bell, CheckCheck, GraduationCap, LifeBuoy, MessagesSquare, ScrollText, Users } from "lucide-react";
import { getInbox, markNotesRead, type Inbox, type InboxNote } from "@/app/(app)/inbox-actions";
import { listen } from "@/lib/supabase/realtime";
import { Avatar } from "@/components/dash/Avatar";

// Fired on window with the unread message count, so the sidebar's Messages link can show it too.
export const INBOX_COUNTS = "et:inbox-counts";

const NOTE_ICONS: Record<string, typeof Bell> = { support: LifeBuoy, message: MessagesSquare, badge: Award, certificate: ScrollText, community: Users, course: GraduationCap };

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Bell (notifications) and messages menus in the header, next to the avatar. Both update live.
export function HeaderInbox({ userId, messagesOn }: { userId: string; messagesOn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [open, setOpen] = useState<"notes" | "messages" | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      getInbox().then((next) => {
        setInbox(next);
        window.dispatchEvent(new CustomEvent(INBOX_COUNTS, { detail: { messages: next.unreadMessages } }));
      }, () => undefined);
    }, 250);
  }, []);

  // Reload on every page change (opening a chat clears its unread count) and whenever something changes live.
  useEffect(load, [load, pathname]);
  useEffect(
    () =>
      listen((supabase) =>
        supabase
          .channel(`inbox:${userId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, load)
          .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
          .on("postgres_changes", { event: "*", schema: "public", table: "support_threads", filter: `user_id=eq.${userId}` }, load)
          .subscribe(),
      ),
    [userId, load],
  );

  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(null);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const readAll = () => {
    setInbox((i) => (i ? { ...i, unreadNotes: 0, notes: i.notes.map((n) => ({ ...n, read: true })) } : i));
    void markNotesRead();
  };

  const openNote = (n: InboxNote) => {
    setOpen(null);
    if (!n.read) {
      setInbox((i) => (i ? { ...i, unreadNotes: Math.max(0, i.unreadNotes - 1), notes: i.notes.map((x) => (x.id === n.id ? { ...x, read: true } : x)) } : i));
      void markNotesRead([n.id]);
    }
    if (n.href) router.push(n.href);
  };

  const notes = inbox?.notes ?? [];
  const threads = inbox?.threads ?? [];
  const count = (n: number) => (n > 9 ? "9+" : String(n));

  return (
    <div className="et-hn" ref={wrap}>
      {messagesOn && (
        <div className="et-hn-slot">
          <button
            type="button"
            className={`et-icon-btn${open === "messages" ? " is-on" : ""}`}
            onClick={() => setOpen(open === "messages" ? null : "messages")}
            aria-label={inbox?.unreadMessages ? `Messages, ${inbox.unreadMessages} unread` : "Messages"}
            aria-expanded={open === "messages"}
            data-tip={open ? undefined : "Messages"}
          >
            <MessagesSquare size={17} />
            {!!inbox?.unreadMessages && <span className="et-hn-count">{count(inbox.unreadMessages)}</span>}
          </button>
          {open === "messages" && (
            <div className="et-hn-panel" role="dialog" aria-label="Messages">
              <header>
                <b>Messages</b>
              </header>
              {threads.length ? (
                <ul>
                  {threads.map((t) => (
                    <li key={`${t.kind}:${t.id}`}>
                      <Link href={t.href} className={t.unread ? "is-unread" : ""} onClick={() => setOpen(null)}>
                        {t.kind === "support" ? (
                          <span className="et-hn-icon is-support">
                            <LifeBuoy size={16} />
                          </span>
                        ) : (
                          <Avatar src={t.avatar} initial={t.title.charAt(0).toUpperCase()} seed={t.title} className="et-hn-avatar" />
                        )}
                        <span className="et-hn-text">
                          <span className="et-hn-row">
                            <b>{t.title}</b>
                            <small>{ago(t.at)}</small>
                          </span>
                          <small className="et-hn-sub">{t.sub}</small>
                          {t.preview && <span className="et-hn-body">{t.preview}</span>}
                        </span>
                        {t.unread > 0 && <i className="et-hn-dot" aria-label="Unread" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="et-hn-empty">No messages yet. Message a tutor from any of your courses, or contact support.</p>
              )}
              <footer>
                <Link href="/learn/messages" onClick={() => setOpen(null)}>
                  All messages
                </Link>
                <Link href="/support" onClick={() => setOpen(null)}>
                  Support
                </Link>
              </footer>
            </div>
          )}
        </div>
      )}

      <div className="et-hn-slot">
        <button
          type="button"
          className={`et-icon-btn${open === "notes" ? " is-on" : ""}`}
          onClick={() => setOpen(open === "notes" ? null : "notes")}
          aria-label={inbox?.unreadNotes ? `Notifications, ${inbox.unreadNotes} unread` : "Notifications"}
          aria-expanded={open === "notes"}
          data-tip={open ? undefined : "Notifications"}
        >
          <Bell size={17} />
          {!!inbox?.unreadNotes && <span className="et-hn-count">{count(inbox.unreadNotes)}</span>}
        </button>
        {open === "notes" && (
          <div className="et-hn-panel" role="dialog" aria-label="Notifications">
            <header>
              <b>Notifications</b>
              {!!inbox?.unreadNotes && (
                <button type="button" onClick={readAll}>
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
            </header>
            {notes.length ? (
              <ul>
                {notes.map((n) => {
                  const Icon = NOTE_ICONS[n.kind] ?? Bell;
                  return (
                    <li key={n.id}>
                      <button type="button" className={n.read ? "" : "is-unread"} onClick={() => openNote(n)}>
                        <span className={`et-hn-icon is-${n.kind}`}>
                          <Icon size={16} />
                        </span>
                        <span className="et-hn-text">
                          <span className="et-hn-row">
                            <b>{n.title}</b>
                            <small>{ago(n.at)}</small>
                          </span>
                          {n.body && <span className="et-hn-body">{n.body}</span>}
                        </span>
                        {!n.read && <i className="et-hn-dot" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="et-hn-empty">You&apos;re all caught up. Replies, badges and certificates show up here.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
