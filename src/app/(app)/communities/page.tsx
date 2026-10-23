import { Suspense } from "react";
import Link from "next/link";
import { BadgeCheck, Plus, Users } from "lucide-react";
import { PageHead } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { JOIN_LABEL, canCreateCommunity, listCommunities, type CommunityCard } from "@/lib/data/communities";

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

function Card({ c }: { c: CommunityCard }) {
  return (
    <Link href={`/communities/${c.slug}`} className="et-cm-card">
      <span className="et-cm-cover" style={c.coverUrl ? { backgroundImage: `url(${c.coverUrl})` } : undefined}>
        {!c.coverUrl && c.name.charAt(0).toUpperCase()}
      </span>
      <span className="et-cm-card-body">
        <b>
          {c.name} {c.isOfficial && <BadgeCheck size={15} className="et-cm-official" aria-label="Official" />}
        </b>
        {c.description && <small className="et-cm-desc">{c.description}</small>}
        <small className="et-cm-meta">
          <Users size={13} /> {c.members.toLocaleString()} {c.members === 1 ? "member" : "members"} · {c.joinMode === "course" && c.courseTitle ? `For ${c.courseTitle}` : JOIN_LABEL[c.joinMode]}
          {c.mine?.status === "pending" ? " · Request sent" : ""}
        </small>
      </span>
    </Link>
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
      {joined.length > 0 && (
        <section className="et-cm-section">
          <h2>Your communities</h2>
          <div className="et-cm-grid">
            {joined.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}
      <section className="et-cm-section">
        <h2>{joined.length ? "Discover more" : "Find a community"}</h2>
        {discover.length ? (
          <div className="et-cm-grid">
            {discover.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <p className="et-muted">{joined.length ? "You're in every community open to you." : "No communities yet."}</p>
        )}
      </section>
    </>
  );
}
