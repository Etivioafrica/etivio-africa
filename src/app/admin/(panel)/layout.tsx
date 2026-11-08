import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import Shell from "@/components/shell/Shell";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { canAccess } from "@/lib/roles";
import "@/app/(app)/app.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Etivio Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="et-app is-light" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const { admin, db } = await requireAdmin();
  const [{ count: chats }, { count: applications }] = admin.isSuper
    ? await Promise.all([
        db.from("support_threads").select("id", { count: "exact", head: true }).eq("staff_unread", true).neq("status", "closed"),
        db.from("role_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ])
    : [{ count: 0 }, { count: 0 }];
  const { count: reviews } = canAccess(admin.roles, "courses")
    ? await db.from("course_reviews").select("id", { count: "exact", head: true }).eq("approved", false)
    : { count: 0 };
  const [{ count: products }, { count: productReviews }] = canAccess(admin.roles, "marketplace")
    ? await Promise.all([
        db.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
        db.from("product_reviews").select("id", { count: "exact", head: true }).eq("approved", false),
      ])
    : [{ count: 0 }, { count: 0 }];
  // Tutor courses and products waiting in the review queue.
  const [{ count: queuedCourses }, { count: queuedProducts }] = canAccess(admin.roles, "review")
    ? await Promise.all([
        db.from("courses").select("id", { count: "exact", head: true }).eq("status", "pending"),
        db.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ])
    : [{ count: 0 }, { count: 0 }];
  const { count: flagged } = canAccess(admin.roles, "moderation") ? await db.from("moderation_flags").select("id", { count: "exact", head: true }).eq("status", "open") : { count: 0 };
  const { count: comments } = canAccess(admin.roles, "blog")
    ? await db.from("blog_comments").select("id", { count: "exact", head: true }).eq("approved", false)
    : { count: 0 };

  // Staff accounts without two-step sign-in get a reminder on every admin page until they turn it on.
  const { data: factors } = await (await createClient()).auth.mfa.listFactors();
  const needs2fa = !factors?.totp.some((f) => f.status === "verified");
  const securityHref = canAccess(admin.roles, "settings") ? "/admin/settings/security" : "/settings/security";

  return (
    <Shell
      mode="admin"
      badges={{ chats: chats ?? 0, applications: applications ?? 0, comments: comments ?? 0, reviews: reviews ?? 0, products: products ?? 0, productReviews: productReviews ?? 0, queue: (queuedCourses ?? 0) + (queuedProducts ?? 0), moderation: flagged ?? 0 }}
      user={{ id: admin.id, name: admin.name, email: admin.email, roles: admin.roles, avatarUrl: admin.avatarUrl }}
    >
      {needs2fa && (
        <div className="et-flash et-flash-err" role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "16px 0 0" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={16} aria-hidden="true" />
            Your admin account has no two-step sign-in. Anyone with your password could get in. Turn it on to protect Etivio.
          </span>
          <Link href={securityHref} className="et-btn et-btn-sm">
            Turn on two-step sign-in
          </Link>
        </div>
      )}
      {children}
    </Shell>
  );
}
