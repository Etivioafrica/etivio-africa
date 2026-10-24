import { Suspense } from "react";
import type { Metadata } from "next";
import Shell from "@/components/shell/Shell";
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

  return (
    <Shell
      mode="admin"
      badges={{ chats: chats ?? 0, applications: applications ?? 0, comments: comments ?? 0, reviews: reviews ?? 0, products: products ?? 0, productReviews: productReviews ?? 0, queue: (queuedCourses ?? 0) + (queuedProducts ?? 0), moderation: flagged ?? 0 }}
      user={{ id: admin.id, name: admin.name, email: admin.email, roles: admin.roles, avatarUrl: admin.avatarUrl }}
    >
      {children}
    </Shell>
  );
}
