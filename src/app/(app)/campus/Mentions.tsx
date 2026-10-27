"use client";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/dash/Avatar";
import { findCampusPeople } from "./actions";

export type Person = { username: string; name: string; avatar: string | null };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// @mention suggestions for a text box: call `onType` on every change with the caret position, show `<MentionList>`
// under the box, and `pick` swaps the half-typed @name for the chosen one. `nearby` (people already in the
// conversation) show the moment "@" is typed and filter as each letter goes in; everyone else on Etivio is looked
// up alongside and joins the list a beat later.
export function useMentions(value: string, setValue: (v: string) => void, box: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, nearby: Person[] = []) {
  const [mention, setMention] = useState<{ start: number; term: string } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (!mention || mention.term.length < 1) return;
    let live = true;
    const t = setTimeout(() => findCampusPeople(mention.term).then((p) => live && setPeople(p)), 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [mention]);

  function onType(next: string, caret: number | null) {
    setValue(next);
    const m = next.slice(0, caret ?? next.length).match(/(?:^|\s)@([a-z0-9_.]{0,30})$/i);
    if (m) setMention({ start: (caret ?? next.length) - m[1].length - 1, term: m[1] });
    else close();
  }
  function close() {
    setMention(null);
    setPeople([]);
  }
  function pick(p: Person) {
    if (!mention) return;
    const end = mention.start + 1 + mention.term.length;
    setValue(`${value.slice(0, mention.start)}@${p.username} ${value.slice(end)}`);
    const pos = mention.start + p.username.length + 2;
    close();
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.setSelectionRange(pos, pos);
    });
  }
  // Enter picks the top suggestion and Escape closes the list; returns true when it used the key.
  function onKey(e: React.KeyboardEvent) {
    if (!mention || !shownNow().length) return false;
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(shownNow()[0]);
      return true;
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return true;
    }
    return false;
  }
  function shownNow() {
    const term = fold(mention?.term ?? "");
    const local = mention ? nearby.filter((p) => !term || fold(`${p.username} ${p.name}`).includes(term)) : [];
    const fetched = mention && term ? people : [];
    return [...local, ...fetched.filter((p) => !local.some((l) => l.username === p.username))].slice(0, 6);
  }
  const shown = shownNow();
  return { open: shown.length > 0, people: shown, onType, onKey, pick };
}

export function MentionList({ people, pick }: { people: Person[]; pick: (p: Person) => void }) {
  return (
    <ul className="et-cps-mentions" role="listbox">
      {people.map((p) => (
        <li key={p.username}>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
            <Avatar src={p.avatar} initial={p.name.charAt(0).toUpperCase()} seed={p.name} className="et-cps-face is-sm" />
            <span>
              <b>{p.name}</b>
              <small>@{p.username}</small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
