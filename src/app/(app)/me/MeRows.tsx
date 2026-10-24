"use client";
import { Moon, LogOut } from "lucide-react";
import { useTheme, writeTheme } from "@/lib/theme";
import { signOut } from "@/app/(app)/actions";

// The two rows on Me that act instead of opening a screen.
export function DarkModeRow() {
  const { light } = useTheme();
  return (
    <button type="button" className="et-me-row" onClick={() => writeTheme(!light)} role="switch" aria-checked={!light}>
      <span className="et-me-ico">
        <Moon size={17} />
      </span>
      <span className="et-me-label">Dark mode</span>
      <span className={`et-me-switch${light ? "" : " is-on"}`}>
        <i />
      </span>
    </button>
  );
}

export function SignOutRow() {
  return (
    <form action={signOut}>
      <button type="submit" className="et-me-row is-danger">
        <span className="et-me-ico">
          <LogOut size={17} />
        </span>
        <span className="et-me-label">Sign out</span>
      </button>
    </form>
  );
}
