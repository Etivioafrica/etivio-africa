import type { AppRole } from "@/lib/roles";

// The role tabs on /admin/users. Shared by the server page (reading ?role=) and the client table.
export const ROLE_TABS: { label: string; value?: AppRole }[] = [
  { label: "All" },
  { label: "Tutors", value: "tutor" },
  { label: "Coaches", value: "coach" },
  { label: "Event managers", value: "event_manager" },
  { label: "Community owners", value: "community_owner" },
  { label: "Editors", value: "editor" },
  { label: "Accounts", value: "accountant" },
  { label: "Super admins", value: "super_admin" },
];
