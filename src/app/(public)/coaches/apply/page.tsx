import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Video, Wallet } from "lucide-react";
import { RoleApplication } from "@/app/(app)/roles/RoleApplication";
import { featureOnForVisitor } from "@/lib/data/features";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import "@/components/coaching/coaching.css";

export const metadata: Metadata = {
  title: "Coach on Etivio",
  description: "Apply to coach learners 1-on-1 on Etivio. Set your hours and price, and get paid for every session.",
  alternates: { canonical: "/coaches/apply" },
};

export default function ApplyPage() {
  return (
    <div className="et-mkt">
      <section className="et-mkt-hero is-tight">
        <h1>Coach on Etivio</h1>
        <p>Help learners across Africa in paid 1-on-1 video sessions. We review every coach before they go live.</p>
      </section>
      <div className="et-cb-perks">
        <div className="et-card et-card-pad">
          <CalendarClock size={20} />
          <b>Your hours</b>
          <p>Set the days and times you&apos;re free. Learners only book those.</p>
        </div>
        <div className="et-card et-card-pad">
          <Wallet size={20} />
          <b>Your price</b>
          <p>Choose what a session costs. Withdraw your earnings from Teach.</p>
        </div>
        <div className="et-card et-card-pad">
          <Video size={20} />
          <b>Simple sessions</b>
          <p>Bookings, payments, reminders and the call link are handled for you.</p>
        </div>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 220 }} />}>
        <Apply />
      </Suspense>
    </div>
  );
}

async function Apply() {
  if (!(await featureOnForVisitor("coaching"))) notFound();
  const viewer = await sessionUser(await createClient());
  if (!viewer)
    return (
      <section className="et-card et-card-pad et-cb-apply">
        <h2>Apply to coach</h2>
        <p className="et-muted">Sign in or create an account first, then come back to this page.</p>
        <Link href="/login?next=/coaches/apply" className="et-btn et-btn-primary">
          Sign in to apply
        </Link>
      </section>
    );
  const { data: role } = await createAdminClient().from("user_roles").select("role").eq("user_id", viewer.id).eq("role", "coach").maybeSingle();
  if (role)
    return (
      <section className="et-card et-card-pad et-cb-apply">
        <h2>You&apos;re an Etivio coach</h2>
        <p className="et-muted">Set up your profile and hours, then publish your page.</p>
        <Link href="/teach/coaching/profile" className="et-btn et-btn-primary">
          Open coach tools
        </Link>
      </section>
    );
  return (
    <section className="et-card et-card-pad et-cb-apply">
      <h2>Apply to coach</h2>
      <RoleApplication userId={viewer.id} role="coach" prompt="What would you coach learners on, and what experience do you have?" />
    </section>
  );
}
