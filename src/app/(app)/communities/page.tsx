import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { canCreateCommunity, listCommunities } from "@/lib/data/communities";
import { CommunityBrowser } from "./CommunityBrowser";

export const metadata = { title: "Communities" };

export default function CommunitiesPage() {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await getCurrentUser();
  const { joined, discover } = await listCommunities(user.id);
  return (
    <>
      <PageHead title="Communities" sub="Learn with other people: ask questions, share wins and meet people taking the same courses.">
        {canCreateCommunity(user.roles) && (
          <Link href="/communities/new" className="et-btn et-btn-primary">
            <Plus size={15} /> New community
          </Link>
        )}
      </PageHead>
      <CommunityBrowser joined={joined} discover={discover} />
    </>
  );
}
