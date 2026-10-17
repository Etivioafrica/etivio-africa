import { Suspense } from "react";
import type { Metadata } from "next";
import Shell from "@/components/shell/Shell";
import { requireAdmin } from "@/lib/admin";
import "@/app/(app)/app.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Etivio Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="et-app" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const { admin, db } = await requireAdmin();
  const { count } = await db
    .from("support_threads")
    .select("id", { count: "exact", head: true })
    .eq("staff_unread", true)
    .neq("status", "closed");

  return (
    <Shell
      mode="admin"
      badges={{ chats: count ?? 0 }}
      user={{ id: admin.id, name: admin.name, email: admin.email, role: admin.role, avatarUrl: admin.avatarUrl, canTeach: true }}
    >
      {children}
    </Shell>
  );
}
