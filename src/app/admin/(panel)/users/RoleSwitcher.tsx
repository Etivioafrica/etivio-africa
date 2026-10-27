"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, ChevronDown, Lock, Minus, Plus, ShieldAlert, X } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { CREATOR_ROLES, LIVE_CREATOR_ROLES, ROLE_BLURBS, ROLE_LABELS, STAFF_ROLES, type AppRole } from "@/lib/roles";
import { toggleUserRole } from "./actions";

const GROUPS: { label: string; roles: AppRole[] }[] = [
  { label: "Staff", roles: STAFF_ROLES },
  { label: "Creators", roles: CREATOR_ROLES },
];

// What each role opens up, shown in the approval dialog (as gains when adding, losses when removing).
const ROLE_PERKS: Record<AppRole, string[]> = {
  super_admin: ["Every admin area, including users, money and settings", "Gives and removes roles for anyone", "Publishes courses without review"],
  editor: ["Blog posts and newsletters", "Dashboard announcements", "Admin overview and settings"],
  accountant: ["Payments, payouts and commission", "Coupons", "Admin overview and settings"],
  reviewer: ["The review queue for tutor courses and products", "Reported posts, messages and profiles"],
  tutor: ["Creates courses (Etivio reviews the first publish)", "Sells templates, e-books and packs on the marketplace", "Earns from each sale and withdraws"],
  coach: ["Offers 1-on-1 sessions over video or phone", "Earns from sessions and withdraws"],
  event_manager: ["Hosts online and in-person events"],
  community_owner: ["Runs a community of learners"],
  student: [],
};

type User = { id: string; name: string; email: string; avatar: string | null; roles: AppRole[] };
type Change = { role: AppRole; on: boolean };

const visible = (roles: AppRole[]) => (roles.length > 1 ? roles.filter((r) => r !== "student") : roles);

// The roles cell on /admin/users: click to open a menu of roles, tick or untick one, approve it in a dialog.
export function RoleSwitcher({ user, self }: { user: User; self: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [change, setChange] = useState<Change | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // The table scrolls sideways, so the menu is fixed to the viewport under the button.
  function toggleMenu() {
    const r = btn.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 280) });
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "mousedown" && (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node))) return;
      setOpen(false);
    };
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  const tags = visible(user.roles).map((r) => (
    <span key={r} className="et-tag">
      {ROLE_LABELS[r]}
    </span>
  ));

  if (self) {
    return (
      <span className="et-inline" style={{ gap: 4 }} title="You can't change your own roles here.">
        {tags}
      </span>
    );
  }

  const host = typeof document !== "undefined" ? (document.querySelector<HTMLElement>(".et-app") ?? document.body) : null;

  return (
    <>
      <button ref={btn} type="button" className={`et-role-btn${open ? " is-open" : ""}`} onClick={toggleMenu} aria-haspopup="menu" aria-expanded={open} aria-label={`Change roles for ${user.name || "user"}`}>
        {tags}
        <ChevronDown size={14} />
      </button>
      {open &&
        host &&
        createPortal(
          <div ref={menu} className="et-role-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
            <div className="et-role-row is-locked">
              <span className="et-role-box is-on">
                <Lock size={10} />
              </span>
              Student
              <small>Everyone</small>
            </div>
            {GROUPS.map((g) => (
              <div key={g.label}>
                <h5>{g.label}</h5>
                {g.roles.map((r) => {
                  const on = user.roles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={on}
                      className="et-role-row"
                      onClick={() => {
                        setOpen(false);
                        setChange({ role: r, on: !on });
                      }}
                    >
                      <span className={`et-role-box${on ? " is-on" : ""}`}>{on && <Check size={11} strokeWidth={3} />}</span>
                      {ROLE_LABELS[r]}
                      {CREATOR_ROLES.includes(r) && !LIVE_CREATOR_ROLES.includes(r) && <small>Coming soon</small>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          host,
        )}
      {change && host && createPortal(<RoleChangeDialog user={user} change={change} onClose={() => setChange(null)} />, host)}
    </>
  );
}

function RoleChangeDialog({ user, change, onClose }: { user: User; change: Change; onClose: () => void }) {
  const { role, on } = change;
  const dialog = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const label = ROLE_LABELS[role];
  const staff = STAFF_ROLES.includes(role);
  const risky = role === "super_admin" || (!on && staff);
  const after = on ? [...user.roles, role] : user.roles.filter((r) => r !== role);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function approve() {
    setError("");
    start(async () => {
      const res = await toggleUserRole(user.id, role, on, note.trim());
      if (res?.error) setError(res.error);
      else onClose();
    });
  }

  const roleList = (roles: AppRole[], mark?: AppRole) => (
    <span className="et-rc-roles">
      {visible(roles).map((r) => (
        <span key={r} className={`et-tag${r === mark ? (on ? " is-added" : " is-removed") : ""}`}>
          {ROLE_LABELS[r]}
        </span>
      ))}
    </span>
  );

  return (
    <dialog
      ref={dialog}
      className="et-modal et-rc"
      aria-label={on ? `Give ${label} role` : `Remove ${label} role`}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(e) => e.target === dialog.current && !pending && onClose()}
    >
      <div className="et-modal-head">
        <div>
          <span className={`et-rc-kicker${on ? "" : " is-remove"}`}>
            {on ? <Plus size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
            {on ? "Give role" : "Remove role"}
          </span>
          <h2>{on ? `Give ${user.name || "this user"} the ${label} role` : `Remove the ${label} role from ${user.name || "this user"}`}</h2>
        </div>
        <button type="button" className="et-icon-btn" onClick={onClose} disabled={pending} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="et-modal-body">
        <div className="et-rc-user">
          <Avatar src={user.avatar} initial={(user.name || user.email).charAt(0).toUpperCase()} seed={user.name || user.email} className="et-avatar" />
          <span>
            <b>{user.name || "Unnamed"}</b>
            <small>{user.email}</small>
          </span>
        </div>

        <div className="et-rc-flow">
          <div>
            <small>Now</small>
            {roleList(user.roles, on ? undefined : role)}
          </div>
          <ArrowRight size={16} />
          <div>
            <small>After</small>
            {roleList(after, on ? role : undefined)}
          </div>
        </div>

        <div className="et-rc-perks">
          <h4>
            {on ? "They'll be able to" : "They'll lose"} <span>· {ROLE_BLURBS[role]}</span>
          </h4>
          <ul>
            {ROLE_PERKS[role].map((p) => (
              <li key={p} className={on ? "" : "is-lost"}>
                {on ? <Check size={13} strokeWidth={3} /> : <Minus size={13} strokeWidth={3} />}
                {p}
              </li>
            ))}
          </ul>
        </div>

        {(staff || (CREATOR_ROLES.includes(role) && !LIVE_CREATOR_ROLES.includes(role))) && (
          <p className={`et-rc-warn${risky ? " is-danger" : ""}`}>
            <ShieldAlert size={15} />
            {CREATOR_ROLES.includes(role)
              ? `${label} tools are coming soon, so this role won't change much for them yet.`
              : on
                ? role === "super_admin"
                  ? "Super admins can see and change everything, including other admins. Only give this to people you fully trust."
                  : "This opens the admin dashboard for them."
                : "They'll lose access to these admin areas straight away."}
          </p>
        )}

        <div className="et-field">
          <label htmlFor="et-rc-note">
            Note <span className="et-muted">(optional, saved in the audit log)</span>
          </label>
          <textarea id="et-rc-note" className="et-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={on ? "Why they're getting this role" : "Why this role is being removed"} />
        </div>

        {error && <p className="et-rc-error">{error}</p>}
      </div>

      <div className="et-modal-foot">
        <button type="button" className="et-btn et-btn-ghost" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button type="button" className={`et-btn ${risky || !on ? "et-btn-danger" : "et-btn-primary"}`} onClick={approve} disabled={pending}>
          {pending ? "Saving…" : on ? `Approve ${label}` : `Remove ${label}`}
        </button>
      </div>
    </dialog>
  );
}
