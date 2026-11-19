import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, ShieldOff, UserMinus } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { getCurrentUser } from "@/lib/auth";
import { communityMembers, getCommunity } from "@/lib/data/communities";
import { removeMember, setModerator } from "../../actions";

export const metadata = { title: "Community members" };

type Props = { params: Promise<{ slug: string }> };

export default function MembersPage({ params }: Props) {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Members params={params} />
      </Suspense>
    </div>
  );
}

async function Members({ params }: Props) {
  const [{ slug }, user] = await Promise.all([params, getCurrentUser()]);
  const c = await getCommunity(slug, user.id, user.roles);
  // Only people inside the community see who else is in it.
  if (!c || !c.isMember) notFound();
  const members = await communityMembers(c.id);
  const isOwner = c.mine?.role === "owner" || user.roles.includes("super_admin");

  return (
    <>
      <Link href={`/communities/${c.slug}`} className="et-back">
        <ArrowLeft size={14} />
        {c.name}
      </Link>
      <section className="et-card">
        <div className="et-card-head">
          <h2>
            Members ({c.members.toLocaleString()})
          </h2>
        </div>
        <ul className="et-cm-requests">
          {members.map((m) => {
            const canRemove = c.canModerate && m.role !== "owner" && m.userId !== user.id && (m.role === "member" || isOwner);
            return (
              <li key={m.userId}>
                <Avatar src={m.avatar} initial={m.name.charAt(0).toUpperCase()} seed={m.name} className="et-cm-face" />
                <span>
                  <b>{m.name}</b>
                  <small>
                    {m.role === "owner" ? "Owner" : m.role === "moderator" ? "Moderator" : "Member"} · joined {new Date(m.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </small>
                </span>
                {isOwner && m.role !== "owner" && (
                  <form action={setModerator}>
                    <input type="hidden" name="slug" value={c.slug} />
                    <input type="hidden" name="user_id" value={m.userId} />
                    <input type="hidden" name="make" value={m.role === "moderator" ? "0" : "1"} />
                    <button type="submit" className="et-icon-btn" aria-label={m.role === "moderator" ? `Remove ${m.name} as moderator` : `Make ${m.name} a moderator`} title={m.role === "moderator" ? "Remove as moderator" : "Make moderator"}>
                      {m.role === "moderator" ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                    </button>
                  </form>
                )}
                {canRemove && (
                  <form action={removeMember}>
                    <input type="hidden" name="slug" value={c.slug} />
                    <input type="hidden" name="user_id" value={m.userId} />
                    <button type="submit" className="et-icon-btn" aria-label={`Remove ${m.name} from the community`} title="Remove from community">
                      <UserMinus size={15} />
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
