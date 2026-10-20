"use client";
import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

// Drop-in replacement for <select> with a styled menu. Takes the same <option> children and props. A hidden native
// <select> mirrors the value, so forms submit it, `required` still blocks submission, and onChange handlers get a
// real element (e.target.value, e.currentTarget.form) exactly as before.

type Opt = { value: string; label: string; disabled: boolean };
type SelectEvent = { target: HTMLSelectElement; currentTarget: HTMLSelectElement };

type Props = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: SelectEvent) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  children: React.ReactNode;
};

const text = (n: React.ReactNode): string =>
  n == null || typeof n === "boolean" ? "" : typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(text).join("") : isValidElement<{ children?: React.ReactNode }>(n) ? text(n.props.children) : "";

function readOptions(children: React.ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode }>(c)) return;
    if (c.type === "option") {
      const label = text(c.props.children);
      out.push({ value: c.props.value !== undefined ? String(c.props.value) : label, label, disabled: !!c.props.disabled });
    } else out.push(...readOptions(c.props.children));
  });
  return out;
}

const SEARCH_FROM = 10;

export function Select({ id, name, value, defaultValue, onChange, required, disabled, className, style, children, ...rest }: Props) {
  const options = readOptions(children);
  // "et-input et-sel-sm" becomes "et-input-wrap et-sel-sm-wrap", so the wrapper never takes the field's own styles.
  const wrapClass = (className ?? "").split(/\s+/).filter(Boolean).map((c) => ` ${c}-wrap`).join("");
  const firstEnabled = options.find((o) => !o.disabled)?.value ?? "";
  const [inner, setInner] = useState(defaultValue ?? (options.some((o) => o.value === "") ? "" : firstEnabled));
  const current = value ?? inner;
  const selected = options.find((o) => o.value === current);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number; host: Element } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const searchable = options.length > SEARCH_FROM;

  const place = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    const width = Math.max(r.width, 200);
    setPos({
      // Kept on screen when the field sits near the right edge.
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      width,
      maxHeight: Math.min(320, up ? above : below),
      // Inside the themed app container so the menu picks up light or dark colours.
      host: trigger.current?.closest(".et-app") ?? document.body,
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) });
  };

  const openMenu = () => {
    if (disabled) return;
    place();
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  const pick = (o: Opt) => {
    if (o.disabled) return;
    if (value === undefined) setInner(o.value);
    // Update the mirrored native select first so handlers (and form submits) see the new value.
    if (native.current) native.current.value = o.value;
    if (native.current && o.value !== current) onChange?.({ target: native.current, currentTarget: native.current });
    close();
  };

  // Close on outside clicks, scrolling or resizing.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    const onMove = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  // Keep the highlighted option in view.
  useLayoutEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const move = (step: number) => {
    if (!shown.length) return;
    let i = active;
    for (let n = 0; n < shown.length; n++) {
      i = (i + step + shown.length) % shown.length;
      if (!shown[i].disabled) break;
    }
    setActive(i);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Enter") {
      if (shown[active]) pick(shown[active]);
    }
    else if (e.key === "Escape" || e.key === "Tab") return close(e.key === "Escape");
    else if (!searchable && e.key.length === 1) {
      // Jump to the next option starting with the typed letter.
      const k = e.key.toLowerCase();
      const i = shown.findIndex((o, j) => j > active && !o.disabled && o.label.toLowerCase().startsWith(k));
      const j = i >= 0 ? i : shown.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(k));
      if (j >= 0) setActive(j);
    } else return;
    e.preventDefault();
  };

  return (
    <span className={`et-sel-wrap${wrapClass}`} style={style}>
      <select
        ref={native}
        name={name}
        value={current}
        onChange={() => {}}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="et-sel-native"
        onFocus={() => trigger.current?.focus()}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        ref={trigger}
        id={id}
        type="button"
        className={`et-sel${className ? ` ${className}` : ""}${open ? " is-open" : ""}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKey}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={rest["aria-label"]}
      >
        <span className={`et-sel-value${!selected || selected.disabled ? " is-placeholder" : ""}`}>{selected?.label || "Select…"}</span>
        <ChevronDown size={15} className="et-sel-chev" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={list}
            id={menuId}
            role="listbox"
            className="et-sel-menu"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
            onKeyDown={onKey}
          >
            {searchable && (
              <label className="et-sel-search">
                <Search size={14} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="Search…"
                  aria-label="Search options"
                />
              </label>
            )}
            {shown.length ? (
              shown.map((o, i) => (
                <div
                  key={o.value}
                  data-i={i}
                  role="option"
                  aria-selected={o.value === current}
                  aria-disabled={o.disabled || undefined}
                  className={`et-sel-opt${i === active ? " is-active" : ""}${o.value === current ? " is-on" : ""}${o.disabled ? " is-disabled" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                >
                  <span>{o.label}</span>
                  {o.value === current && !o.disabled && <Check size={15} />}
                </div>
              ))
            ) : (
              <p className="et-sel-empty">No matches</p>
            )}
          </div>,
          pos.host,
        )}
    </span>
  );
}
