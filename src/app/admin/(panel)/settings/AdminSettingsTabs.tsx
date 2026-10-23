"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

export function AdminSettingsTabs({ showAppearance }: { showAppearance: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/settings", label: "Profile" },
    { href: "/admin/settings/security", label: "Security" },
    { href: "/admin/settings/platform", label: "Platform" },
    ...(showAppearance
      ? [
          { href: "/admin/settings/learning", label: "Learning" },
          { href: "/admin/settings/appearance", label: "Appearance" },
          { href: "/admin/settings/features", label: "Features" },
        ]
      : []),
  ];
  const current = tabs.find((t) => t.href === pathname) ?? tabs[0];
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
        {tabs.map(({ href, label }) => (
          <Link key={href} href={href} className={pathname === href ? "is-on" : ""} aria-current={pathname === href ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
