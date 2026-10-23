import { notFound } from "next/navigation";
import { featureOn } from "@/lib/data/features";

// The wallet pages exist only while the Wallet feature is on (Settings → Features).
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await featureOn("wallet"))) notFound();
  return children;
}
