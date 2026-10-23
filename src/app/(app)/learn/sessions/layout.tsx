import { notFound } from "next/navigation";
import { featureOn } from "@/lib/data/features";
import "@/components/coaching/coaching.css";

// Coaching sessions exist while Coaching is on (Settings → Features).
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await featureOn("coaching"))) notFound();
  return children;
}
