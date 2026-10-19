"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";


const TABS = [
  { href: "/settings", label: "My details" },
  { href: "/settings/account", label: "Account" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/notifications", label: "Notifications" },
];

// Right side of the banner. On My details the buttons drive the profile form by id.
export function SettingsHeader({ profileHref }: { profileHref: string }) {
  const pathname = usePathname();
  if (pathname !== "/settings")
    return (
      <div className="et-set-actions">
        <Link href={profileHref} className="et-btn et-btn-ghost">
          View profile
        </Link>
      </div>
    );
  return (
    <div className="et-set-actions">
      <button type="reset" form="settings-details" className="et-btn et-btn-ghost">
        Cancel
      </button>
      <button type="submit" form="settings-details" className="et-btn et-btn-primary">
        Save changes
      </button>
    </div>
  );
}

export function SettingsTabs() {
  const pathname = usePathname();
  const current = TABS.find((t) => t.href === pathname) ?? TABS[0];
  return (
    <>
      <div>
        <p className="et-set-crumb">
          <Settings size={12} />
          Settings <span>/</span> {current.label}
        </p>
        <h1>Settings</h1>
      </div>
      <nav className="et-seg" aria-label="Settings sections">
        {TABS.map(({ href, label }) => (
          <Link key={href} href={href} className={pathname === href ? "is-on" : ""} aria-current={pathname === href ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
