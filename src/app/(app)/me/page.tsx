import Link from "next/link";
import { cookies } from "next/headers";
import {
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  ChevronRight,
  CreditCard,
  FolderDown,
  Heart,
  Inbox,
  LifeBuoy,
  Megaphone,
  Presentation,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { getCurrentUser } from "@/lib/auth";
import { featuresFor } from "@/lib/data/features";
import { ROLE_LABELS, canEarn, canTeach, isCoach, isStaff, primaryRole, showsTeach } from "@/lib/roles";
import { DarkModeRow, SignOutRow } from "./MeRows";
import "./me.css";

export const metadata = { title: "Me" };

type Row = { label: string; href: string; icon: LucideIcon; hint?: string };

// The phone app's Me tab: your profile, then everything that lived in the sidebar, grouped like an iOS settings list.
export default async function MePage() {
  const [user, jar] = await Promise.all([getCurrentUser(), cookies()]);
  const f = await featuresFor(user.roles);
  const teachSide = jar.get("et-side")?.value === "teach" && showsTeach(user.roles, user.tutorApplication);
  const display = user.name || user.email;

  const learning: Row[] = [
    // Campus has the Inbox tab's place, so messages are reached from here.
    ...(f.messages ? [{ label: "Messages", href: "/learn/messages", icon: Inbox }] : []),
    { label: "Announcements", href: "/learn/announcements", icon: Megaphone },
    { label: "Library", href: "/learn/library", icon: FolderDown },
    { label: "Saved", href: "/profile/saved", icon: Heart },
    { label: "Certificates", href: "/profile/certificates", icon: Award },
    ...(f.wallet ? [{ label: "Wallet", href: "/learn/wallet", icon: Wallet }] : []),
    ...(f.coaching ? [{ label: "Coaching sessions", href: "/learn/sessions", icon: CalendarClock }] : []),
    ...(f.communities ? [{ label: "Communities", href: "/communities", icon: Users }] : []),
  ];
  const teaching: Row[] = teachSide
    ? [
        ...(canTeach(user.roles) ? [{ label: "Marketplace products", href: "/teach/products", icon: Store }] : []),
        ...(isCoach(user.roles) ? [{ label: "Coaching", href: "/teach/coaching", icon: CalendarClock }] : []),
        ...(canEarn(user.roles) ? [{ label: "Earnings", href: "/teach/earnings", icon: Wallet }] : []),
        { label: "Switch to Learn", href: "/learn", icon: BookOpen },
      ]
    : showsTeach(user.roles, user.tutorApplication)
      ? [{ label: "Switch to Teach", href: "/teach", icon: Presentation }]
      : [{ label: "Teach on Etivio", href: "/teach-on-etivio", icon: Presentation, hint: "Share what you know" }];
  const account: Row[] = [
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Notifications", href: "/settings/notifications", icon: Bell },
    { label: "Billing", href: "/settings/billing", icon: CreditCard },
    { label: "Help and support", href: "/support", icon: LifeBuoy },
    ...(isStaff(user.roles) ? [{ label: "Admin dashboard", href: "/admin", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="et-page et-me">
      <Link href="/profile" className="et-me-card">
        <Avatar src={user.avatarUrl} initial={display.charAt(0).toUpperCase()} seed={display} className="et-me-avatar" />
        <span className="et-me-who">
          <b>{user.name || "Your account"}</b>
          <small>{user.email}</small>
          <em>{ROLE_LABELS[primaryRole(user.roles)]}</em>
        </span>
        <ChevronRight size={18} />
      </Link>

      {!teachSide && <Group title="Learning" rows={learning} />}
      <Group title={teachSide ? "Teaching" : "Teach"} rows={teaching} />
      <Group title="Account" rows={account}>
        <DarkModeRow />
      </Group>
      <div className="et-me-group">
        <SignOutRow />
      </div>
    </div>
  );
}

function Group({ title, rows, children }: { title: string; rows: Row[]; children?: React.ReactNode }) {
  return (
    <section>
      <p className="et-me-title">{title}</p>
      <div className="et-me-group">
        {rows.map(({ label, href, icon: Icon, hint }) => (
          <Link key={href + label} href={href} className="et-me-row">
            <span className="et-me-ico">
              <Icon size={17} />
            </span>
            <span className="et-me-label">{label}</span>
            {hint && <small>{hint}</small>}
            <ChevronRight size={16} className="et-me-chev" />
          </Link>
        ))}
        {children}
      </div>
    </section>
  );
}
