import type { Database } from "@/lib/database.types";

// Shared by server and client. One account can hold several roles; everyone is a student.
export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super admin",
  editor: "Editor",
  accountant: "Accounts",
  tutor: "Tutor",
  student: "Student",
  coach: "Coach",
  event_manager: "Event manager",
  community_owner: "Community owner",
};

export const ROLE_BLURBS: Record<AppRole, string> = {
  super_admin: "Owns the platform. Manages everything.",
  editor: "Runs the blog, newsletters, and posts.",
  accountant: "Manages money and tutor payouts.",
  tutor: "Publishes courses and earns a share of each sale.",
  student: "Takes courses and uses course materials.",
  coach: "Meets learners 1-on-1 over video or phone calls.",
  event_manager: "Hosts online and in-person events.",
  community_owner: "Runs a community of learners.",
};

// Granted only by a super admin; these open the admin dashboard.
export const STAFF_ROLES: AppRole[] = ["super_admin", "editor", "accountant"];
// Applied for by users and approved by a super admin.
export const CREATOR_ROLES: AppRole[] = ["tutor", "coach", "event_manager", "community_owner"];
// Creator roles whose features exist today. The rest can be assigned but show as coming soon.
export const LIVE_CREATOR_ROLES: AppRole[] = ["tutor"];

export const isStaff = (roles: AppRole[]) => roles.some((r) => STAFF_ROLES.includes(r));
export const canTeach = (roles: AppRole[]) => roles.includes("tutor") || roles.includes("super_admin");

// The Teach area stays hidden from learners until they've applied to teach (or can already teach).
export const showsTeach = (roles: AppRole[], application: string | null) => canTeach(roles) || application === "pending" || application === "rejected";

// Admin dashboard areas and who can open them. Super admins open everything.
export const ADMIN_AREAS = {
  dashboard: ["super_admin", "editor", "accountant"],
  users: ["super_admin"],
  courses: ["super_admin"],
  blog: ["super_admin", "editor"],
  announcements: ["super_admin", "editor"],
  documents: ["super_admin"],
  chats: ["super_admin"],
  tracking: ["super_admin"],
  financials: ["super_admin", "accountant"],
  team: ["super_admin"],
  emails: ["super_admin"],
  settings: ["super_admin", "editor", "accountant"],
  platform: ["super_admin"],
} satisfies Record<string, AppRole[]>;

export type AdminArea = keyof typeof ADMIN_AREAS;

export const canAccess = (roles: AppRole[], area: AdminArea) => roles.some((r) => (ADMIN_AREAS[area] as AppRole[]).includes(r));

// Most senior role first, for one-word labels.
const ORDER: AppRole[] = ["super_admin", "accountant", "editor", "tutor", "coach", "event_manager", "community_owner", "student"];
export const primaryRole = (roles: AppRole[]) => ORDER.find((r) => roles.includes(r)) ?? "student";
