"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Search, Users } from "lucide-react";
import { JOIN_LABEL, type CommunityCard, type JoinMode } from "@/lib/data/communities-shared";

type Filter = "all" | JoinMode;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "request", label: "Request to join" },
  { id: "course", label: "Course" },
];

function Card({ c }: { c: CommunityCard }) {
  return (
    <Link href={`/communities/${c.slug}`} className="et-cm-card">
      <span className="et-cm-cover" style={c.coverUrl ? { backgroundImage: `url(${c.coverUrl})` } : undefined}>
        {!c.coverUrl && c.name.charAt(0).toUpperCase()}
      </span>
      <span className="et-cm-card-body">
        <b>
          {c.name} {c.isOfficial && <BadgeCheck size={15} className="et-cm-official" aria-label="Official" />}
        </b>
        {c.description && <small className="et-cm-desc">{c.description}</small>}
        <small className="et-cm-meta">
          <Users size={13} /> {c.members.toLocaleString()} {c.members === 1 ? "member" : "members"} · {c.joinMode === "course" && c.courseTitle ? `For ${c.courseTitle}` : JOIN_LABEL[c.joinMode]}
          {c.mine?.status === "pending" ? " · Request sent" : ""}
        </small>
      </span>
    </Link>
  );
}

// Search by name, description or course, and narrow Discover by how people join. "Your communities" is only searched.
export function CommunityBrowser({ joined, discover }: { joined: CommunityCard[]; discover: CommunityCard[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const term = q.trim().toLowerCase();
  const matches = (c: CommunityCard) => !term || [c.name, c.description, c.courseTitle].some((t) => t?.toLowerCase().includes(term));
  const mine = useMemo(() => joined.filter(matches), [joined, term]); // eslint-disable-line react-hooks/exhaustive-deps
  const found = useMemo(() => discover.filter((c) => matches(c) && (filter === "all" || c.joinMode === filter)), [discover, term, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const searching = term !== "" || filter !== "all";

  return (
    <>
      {joined.length + discover.length > 3 && (
        <div className="et-cm-tools-bar">
          <label className="et-cm-search">
            <Search size={15} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search communities" aria-label="Search communities" maxLength={80} />
          </label>
          <div className="et-cm-chips" role="group" aria-label="Filter by how you join">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={`et-cm-chip${filter === f.id ? " is-on" : ""}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {mine.length > 0 && (
        <section className="et-cm-section">
          <h2>Your communities</h2>
          <div className="et-cm-grid">
            {mine.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}
      <section className="et-cm-section">
        <h2>{joined.length ? "Discover more" : "Find a community"}</h2>
        {found.length ? (
          <div className="et-cm-grid">
            {found.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <p className="et-muted">{searching ? "Nothing matches that. Try a different word or filter." : joined.length ? "You're in every community open to you." : "No communities yet."}</p>
        )}
      </section>
    </>
  );
}
