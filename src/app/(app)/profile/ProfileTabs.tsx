"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";

const TABS = [
  { href: "/profile", label: "Overview" },
  { href: "/profile/courses", label: "Courses" },
  { href: "/profile/certificates", label: "Certificates" },
  { href: "/profile/activity", label: "Activity" },
  { href: "/profile/badges", label: "Badges" },
  { href: "/profile/notes", label: "Notes" },
];

export function ProfileTabs() {
  const pathname = usePathname();
  const current = TABS.find((t) => t.href === pathname) ?? TABS[0];
  return (
    <>
      <div>
        <p className="et-set-crumb">
          <UserRound size={12} />
          Profile <span>/</span> {current.label}
        </p>
        <h1>Profile</h1>
      </div>
      <nav className="et-seg" aria-label="Profile sections">
        {TABS.map(({ href, label }) => (
          <Link key={href} href={href} className={pathname === href ? "is-on" : ""} aria-current={pathname === href ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
