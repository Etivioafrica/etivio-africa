import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { canCreateCommunity } from "@/lib/data/communities";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateCommunityForm } from "./CreateCommunityForm";

export const metadata = { title: "New community" };

export default async function NewCommunity() {
  const user = await getCurrentUser();
  if (!canCreateCommunity(user.roles)) redirect("/communities");
  const staff = user.roles.includes("super_admin");
  // Course spaces: tutors link their own courses; Etivio staff can link any published course.
  const q = createAdminClient().from("courses").select("id, title").order("title");
  const { data: courses } = staff ? await q.eq("status", "published") : await q.eq("instructor_id", user.id);
  return (
    <div className="et-page">
      <Link href="/communities" className="et-back">
        <ArrowLeft size={14} />
        Communities
      </Link>
      <PageHead title="New community" sub="Start a space for your learners. You'll be its owner: you decide who joins, approve requests and pin posts." />
      <CreateCommunityForm courses={courses ?? []} canOfficial={staff} />
    </div>
  );
}
