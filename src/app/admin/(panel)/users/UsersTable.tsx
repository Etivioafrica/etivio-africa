"use client";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { Status } from "@/components/dash/ui";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { RoleSwitcher } from "./RoleSwitcher";
import { ROLE_TABS } from "./tabs";

const PAGE = 25;

export type UserRow = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  roles: AppRole[];
  status: string;
  enrolled: number;
  courses: number;
  joined: string;
  lastSignIn: string | null;
  confirmed: boolean;
};

type Props = {
  rows: UserRow[];
  // true: every account is loaded and filtered here as you type. false: rows are one server-searched page.
  local: boolean;
  serverTotal: number;
  initial: { q: string; role?: AppRole; page: number };
  deleted: boolean;
  adminId: string;
};

// Lowercase, accents off, so "adegboye" finds "Adégboyè".
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function UsersTable({ rows, local, serverTotal, initial, deleted, adminId }: Props) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initial.q);
  const [role, setRole] = useState<AppRole | undefined>(initial.role);
  const [page, setPage] = useState(initial.page);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const deferredQ = useDeferredValue(q);

  // Search text for each row, built once per load.
  const haystack = useMemo(() => new Map(rows.map((u) => [u.id, fold(`${u.name} ${u.email}`)])), [rows]);

  const matches = useMemo(() => {
    if (!local) return rows;
    const words = fold(deferredQ.trim()).split(/\s+/).filter(Boolean);
    return rows.filter((u) => (!role || u.roles.includes(role)) && words.every((w) => haystack.get(u.id)!.includes(w)));
  }, [rows, local, deferredQ, role, haystack]);

  const total = local ? matches.length : serverTotal;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const current = Math.min(page, pages);
  const shown = local ? matches.slice((current - 1) * PAGE, current * PAGE) : rows;

  // Mirrors the filters into the URL so the view can be shared or reloaded.
  function urlFor(next: { q?: string; role?: AppRole; page?: number }) {
    const p = new URLSearchParams(params.toString());
    const set = (k: string, v: string | number | undefined) => (v ? p.set(k, String(v)) : p.delete(k));
    set("q", next.q?.trim());
    set("role", next.role);
    set("page", next.page && next.page > 1 ? next.page : undefined);
    return `${path}${p.size ? `?${p}` : ""}`;
  }

  function update(next: { q: string; role?: AppRole; page: number }) {
    setQ(next.q);
    setRole(next.role);
    setPage(next.page);
    clearTimeout(timer.current);
    const url = urlFor(next);
    if (local) window.history.replaceState(null, "", url);
    // Server mode: wait for a pause in typing, but tab and page changes go straight away.
    else if (next.q !== q) timer.current = setTimeout(() => start(() => router.replace(url, { scroll: false })), 250);
    else start(() => router.replace(url, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <section className="et-card">
      <div className="et-filters">
        <div className="et-tabs">
          {ROLE_TABS.map((t) => (
            <button key={t.label} type="button" className={t.value === role ? "is-on" : ""} onClick={() => update({ q, role: t.value, page: 1 })}>
              {t.label}
            </button>
          ))}
        </div>
        <form role="search" className="et-user-search" onSubmit={(e) => e.preventDefault()}>
          {pending ? <Loader2 size={15} className="et-spin" /> : <Search size={15} />}
          <input value={q} onChange={(e) => update({ q: e.target.value, role, page: 1 })} className="et-input" placeholder="Search name or email" aria-label="Search users" autoComplete="off" />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => update({ q: "", role, page: 1 })}>
              <X size={14} />
            </button>
          )}
        </form>
      </div>
      {(q || role) && (
        <p className="et-user-count">
          {total} {total === 1 ? "match" : "matches"}
          {role && ` in ${ROLE_TABS.find((t) => t.value === role)?.label.toLowerCase()}`}
        </p>
      )}
      {shown.length ? (
        <div className="et-table-wrap">
          <table className="et-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Roles</th>
                <th>Status</th>
                <th className="et-th-right">Enrolled</th>
                <th className="et-th-right">Courses</th>
                <th>Joined</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="et-cell-main">
                      <Avatar src={u.avatar} initial={(u.name || u.email).charAt(0).toUpperCase()} seed={u.name || u.email} className="et-avatar" />
                      <span>
                        <b>{u.name || "Unnamed"}</b>
                        <small>
                          {u.email}
                          {!u.confirmed && " · unconfirmed"}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    {deleted ? (
                      <span className="et-inline" style={{ gap: 4 }}>
                        {(u.roles.length > 1 ? u.roles.filter((r) => r !== "student") : u.roles).map((r) => (
                          <span key={r} className="et-tag">
                            {ROLE_LABELS[r]}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <RoleSwitcher user={{ id: u.id, name: u.name, email: u.email, avatar: u.avatar, roles: u.roles }} self={u.id === adminId} />
                    )}
                  </td>
                  <td>
                    <Status value={u.status} />
                  </td>
                  <td className="et-td-right">{u.enrolled}</td>
                  <td className="et-td-right">{u.courses}</td>
                  <td>{formatDate(u.joined)}</td>
                  <td>{u.lastSignIn ? formatDate(u.lastSignIn) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="et-empty">{q || role ? "No users match." : "No users yet."}</p>
      )}
      {pages > 1 && (
        <div className="et-pager">
          <span>
            Page {current} of {pages}
          </span>
          <div>
            {current > 1 && (
              <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => update({ q, role, page: current - 1 })}>
                <ChevronLeft size={14} /> Prev
              </button>
            )}
            {current < pages && (
              <button type="button" className="et-btn et-btn-ghost et-btn-sm" onClick={() => update({ q, role, page: current + 1 })}>
                Next <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
