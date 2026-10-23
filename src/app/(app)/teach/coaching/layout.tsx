import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { featureOn } from "@/lib/data/features";
import { isCoach } from "@/lib/roles";
import "@/components/coaching/coaching.css";

// Coach tools exist while Coaching is on (Settings → Features), for people with the coach role.
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await featureOn("coaching"))) notFound();
  const user = await getCurrentUser();
  if (!isCoach(user.roles)) redirect("/coaches/apply");
  return children;
}
