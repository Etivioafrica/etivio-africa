import { notFound } from "next/navigation";
import { featureOn } from "@/lib/data/features";

// Communities exist only while the Communities feature is on (Settings → Features).
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await featureOn("communities"))) notFound();
  return children;
}
