"use client";
import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

export type ChatRow = { id: string; subject: string; status: string; unread: boolean; at: string; name: string };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const STATUS_LABEL: Record<string, string> = { pending: "Awaiting user", closed: "Closed" };

// The inbox list with instant search. Empty search shows the current tab; typing searches every conversation by
// person or subject, with each result's status shown.
export function ChatItems({ rows, filter, activeId }: { rows: ChatRow[]; filter: string; activeId?: string }) {
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const haystack = useMemo(() => new Map(rows.map((r) => [r.id, fold(`${r.name} ${r.subject}`)])), [rows]);
  const words = fold(query.trim()).split(/\s+/).filter(Boolean);
  const inTab = (r: ChatRow) => (filter === "all" ? true : filter === "open" ? r.status === "open" || r.status === "pending" : r.status === filter);
  const shown = words.length ? rows.filter((r) => words.every((w) => haystack.get(r.id)!.includes(w))) : rows.filter(inTab);
  const qs = filter === "open" ? "" : `?status=${filter}`;

  return (
    <>
      <div className="et-chat-find">
        <Search size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or subject" aria-label="Search conversations" />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>
      {words.length > 0 && (
        <small className="et-chat-find-count">
          {shown.length} {shown.length === 1 ? "conversation" : "conversations"} found
        </small>
      )}
      {shown.length ? (
        shown.map((t) => (
          <Link key={t.id} href={`/admin/chats/${t.id}${qs}`} className={`et-chat-item${t.id === activeId ? " is-active" : ""}${t.unread ? " is-unread" : ""}`}>
            <span className="et-chat-item-top">
              <span>{t.name}</span>
              <span>{t.at}</span>
            </span>
            <b>{t.subject}</b>
            {STATUS_LABEL[t.status] && (words.length > 0 || (t.status === "pending" && filter !== "pending")) && (
              <small className={`et-chat-item-tag${t.status === "closed" ? " is-closed" : ""}`}>{STATUS_LABEL[t.status]}</small>
            )}
          </Link>
        ))
      ) : (
        <p className="et-empty">{words.length ? "No conversations match." : "No conversations here."}</p>
      )}
    </>
  );
}
