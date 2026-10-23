import { notFound } from "next/navigation";
import { featureOn } from "@/lib/data/features";

// Messages exist only while the Messages feature is on (Settings → Features).
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await featureOn("messages"))) notFound();
  return children;
}
