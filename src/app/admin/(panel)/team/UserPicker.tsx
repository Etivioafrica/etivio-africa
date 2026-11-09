"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { searchUsersForTeam } from "./actions";

type Hit = { id: string; name: string; email: string; avatar: string | null };

// Email box with live search of existing users. Pick someone from the list, or type any email to invite a new person.
export function UserPicker() {
  const [value, setValue] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Hit | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (picked && picked.email === value) return;
    setPicked(null);
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const r = await searchUsersForTeam(q).catch(() => []);
      if (live) {
        setHits(r);
        setActive(0);
        setOpen(true);
      }
    }, 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(h: Hit) {
    setPicked(h);
    setValue(h.email);
    setOpen(false);
  }

  return (
    <div className="et-field" ref={wrap} style={{ position: "relative" }}>
      <label htmlFor="email">Search users or enter an email</label>
      <div style={{ position: "relative" }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--a-faint)" }} aria-hidden />
        <input
          id="email"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="off"
          required
          value={value}
          placeholder="Name or email"
          style={{ paddingLeft: 34 }}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !hits.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(hits[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls="team-user-list"
        />
      </div>
      {picked && (
        <small className="et-muted" style={{ display: "block", marginTop: 6 }}>
          Existing account: {picked.name || picked.email}. They get the role straight away.
        </small>
      )}
      {open && value.trim().length >= 2 && (
        <ul
          id="team-user-list"
          role="listbox"
          style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: "100%", marginTop: 4, padding: 6, listStyle: "none", maxHeight: 280, overflowY: "auto", border: "1px solid var(--a-border)", borderRadius: 12, background: "var(--a-panel)", boxShadow: "0 12px 32px rgba(0,0,0,.18)" }}
        >
          {hits.length ? (
            hits.map((h, i) => (
              <li
                key={h.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
                onMouseEnter={() => setActive(i)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: i === active ? "var(--a-hover)" : "transparent" }}
              >
                {h.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.avatar} alt="" width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "50%", background: "var(--a-panel-2)" }}>
                    <UserRound size={14} />
                  </span>
                )}
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 13.5 }}>{h.name || "No name"}</b>
                  <small className="et-muted" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{h.email}</small>
                </span>
              </li>
            ))
          ) : (
            <li style={{ padding: "8px 10px", fontSize: 13 }} className="et-muted">
              No account found. {value.includes("@") ? "Press Add to team to invite this email." : "Type their full email to invite them."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
