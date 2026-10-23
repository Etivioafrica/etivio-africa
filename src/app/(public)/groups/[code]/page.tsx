import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CheckCircle2, Clock, Users } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { CopyLink } from "@/components/dash/CopyLink";
import { ShareButton } from "@/components/dash/ShareButton";
import { GroupButton } from "@/components/market/GroupButton";
import { getGroup } from "@/lib/data/group-buy";
import { featureOnForVisitor } from "@/lib/data/features";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { formatPrice } from "@/lib/format";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await getGroup((await params).code);
  if (!g) return { title: "Group not found | Etivio", robots: { index: false } };
  const title = `Join my group for ${g.course.title}`;
  const description = `${g.discountPercent}% off on Etivio when ${g.size} people join. ${formatPrice(g.unitPriceMinor, g.currency)} each instead of ${formatPrice(g.course.priceMinor, g.currency)}.`;
  return { title: `${title} | Etivio`, description, robots: { index: false }, openGraph: { title, description, images: g.course.coverUrl ? [g.course.coverUrl] : undefined } };
}

export default function GroupPage({ params }: Props) {
  return (
    <div className="et-mkt">
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Group params={params} />
      </Suspense>
    </div>
  );
}

const clock = () => Date.now();

function timeLeft(iso: string) {
  const ms = Date.parse(iso) - clock();
  if (ms <= 0) return "Time's up";
  const h = Math.floor(ms / 3_600_000);
  return h >= 48 ? `${Math.floor(h / 24)} days left` : h >= 1 ? `${h} hours left` : `${Math.max(1, Math.round(ms / 60_000))} minutes left`;
}

// The share link for a group buy: who's in, places left, time left, and the button to join and pay.
async function Group({ params }: Props) {
  const { code } = await params;
  const [g, viewer, on] = await Promise.all([getGroup(code), createClient().then(sessionUser), featureOnForVisitor("group_buy")]);
  if (!g || !on) notFound();
  await connection();
  const isMember = !!viewer && g.members.some((m) => m.id === viewer.id);
  const open = g.status === "open" && Date.parse(g.expiresAt) > clock();
  const placesLeft = Math.max(0, g.size - g.members.length);
  const path = `/groups/${g.code}`;

  return (
    <section className="et-gp">
      <div className="et-gp-card">
        {g.course.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="et-gp-cover" src={g.course.coverUrl} alt="" />
        )}
        <div className="et-gp-body">
          <span className="et-gp-tag">
            <Users size={14} /> Group buy · {g.discountPercent}% off
          </span>
          <h1>{g.course.title}</h1>
          <p className="et-gp-by">by {g.course.instructor}</p>

          <p className="et-gp-price">
            {formatPrice(g.unitPriceMinor, g.currency)} <s>{formatPrice(g.course.priceMinor, g.currency)}</s> <small>each</small>
          </p>

          <div className="et-gp-progress">
            <div className="et-gp-progress-head">
              <b>
                {g.members.length} of {g.size} joined
              </b>
              <span>
                <Clock size={14} /> {g.status === "filled" ? "Group complete" : open ? timeLeft(g.expiresAt) : "Closed"}
              </span>
            </div>
            <div className="et-gp-bar">
              <i style={{ width: `${Math.min(100, (g.members.length / g.size) * 100)}%` }} />
            </div>
            <ul className="et-gp-slots">
              {Array.from({ length: g.size }, (_, i) => {
                const m = g.members[i];
                return <li key={i}>{m ? <Avatar src={m.avatar} initial={m.name.charAt(0).toUpperCase()} seed={m.name} className="et-gp-face" /> : <span className="et-gp-empty" />}</li>;
              })}
            </ul>
          </div>

          {g.status === "filled" ? (
            <div className="et-gp-note is-done">
              <CheckCircle2 size={18} />
              <span>This group is complete and everyone has the course.{isMember ? " Find it in My courses." : ""}</span>
            </div>
          ) : !open ? (
            <div className="et-gp-note">
              <span>This group closed before it filled. Members got their money back in their Etivio wallet.</span>
            </div>
          ) : isMember ? (
            <div className="et-gp-note is-done">
              <CheckCircle2 size={18} />
              <span>
                You&apos;re in. {placesLeft} {placesLeft === 1 ? "place" : "places"} left: share the link so the group fills in time.
              </span>
            </div>
          ) : (
            <GroupButton mode="join" code={g.code} label={`Join for ${formatPrice(g.unitPriceMinor, g.currency)}`} />
          )}

          {open && (
            <div className="et-gp-share">
              <CopyLink path={path} label="Copy group link" />
              <ShareButton title={`Join my group for ${g.course.title} on Etivio`} path={path} className="et-btn et-btn-ghost" />
            </div>
          )}

          <ul className="et-gp-rules">
            <li>Everyone pays {formatPrice(g.unitPriceMinor, g.currency)} when they join.</li>
            <li>When all {g.size} places are taken, everyone gets the course straight away.</li>
            <li>If the group doesn&apos;t fill in time, your payment goes to your Etivio wallet to spend on any course.</li>
          </ul>
          {(!open || g.status === "filled") && (
            <Link href={`/courses/${g.course.slug}`} className="et-btn et-btn-ghost">
              See the course
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
