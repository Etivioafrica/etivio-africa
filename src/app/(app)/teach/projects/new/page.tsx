import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { canEarn } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProjectForm } from "../ProjectForm";

export const metadata = { title: "New project" };

export default async function NewProject() {
  const user = await getCurrentUser();
  if (!canEarn(user.roles)) redirect("/teach");
  const { data: courses } = await createAdminClient().from("courses").select("id, title").eq("instructor_id", user.id).order("title");
  return (
    <div className="et-page">
      <Link href="/teach/projects" className="et-back">
        <ArrowLeft size={14} /> Projects
      </Link>
      <PageHead title="New project" sub="Write the brief. It stays a private draft until you publish it." />
      <section className="et-card et-card-pad">
        <ProjectForm courses={courses ?? []} />
      </section>
    </div>
  );
}
