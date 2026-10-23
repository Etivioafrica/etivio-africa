import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, Globe, MapPin } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { BookingPanel } from "@/components/coaching/BookingPanel";
import { getCoach } from "@/lib/data/coaching";
import { featureOnForVisitor } from "@/lib/data/features";
import { walletBalance } from "@/lib/data/wallet";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import "@/components/coaching/coaching.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCoach((await params).slug, null);
  if (!c) return { title: "Coach not found | Etivio", robots: { index: false } };
  const title = `Book a session with ${c.name}`;
  const description = c.headline ?? `1-on-1 coaching with ${c.name} on Etivio.`;
  return { title: `${title} | Etivio`, description, alternates: { canonical: `/coaches/${c.slug}` }, openGraph: { title, description, images: c.avatar ? [c.avatar] : undefined } };
}

export default function CoachPage({ params }: Props) {
  return (
    <div className="et-mkt">
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Coach params={params} />
      </Suspense>
    </div>
  );
}

async function Coach({ params }: Props) {
  const { slug } = await params;
  const viewer = await createClient().then(sessionUser);
  const [coach, on] = await Promise.all([getCoach(slug, viewer?.id ?? null), featureOnForVisitor("coaching")]);
  if (!coach || !on) notFound();
  await connection();
  const wallet = viewer && coach.price_minor > 0 ? await walletBalance(viewer.id) : 0;
  const isSelf = viewer?.id === coach.user_id;

  return (
    <section className="et-cb-page">
      <Link href="/coaches" className="et-cb-back">
        <ArrowLeft size={15} /> All coaches
      </Link>
      {isSelf && coach.status !== "live" && (
        <p className="et-flash et-flash-err">
          Your page isn&apos;t live yet, so only you can see it. Publish it from <Link href="/teach/coaching/profile">your coach profile</Link>.
        </p>
      )}
      <div className="et-cb-layout">
        <div className="et-card et-cb-about">
          <div className="et-cb-hero">
            <Avatar src={coach.avatar} initial={coach.name.charAt(0).toUpperCase()} seed={coach.name} className="et-cb-avatar is-big" />
            <div>
              <h1>{coach.name}</h1>
              {coach.headline && <p className="et-cb-headline">{coach.headline}</p>}
              <p className="et-cb-meta">
                {coach.profile?.location && (
                  <span>
                    <MapPin size={13} /> {coach.profile.location}
                  </span>
                )}
                <span>
                  <Globe size={13} /> {coach.timezone.replace("_", " ")}
                </span>
              </p>
            </div>
          </div>
          {coach.topics.length > 0 && (
            <div className="et-cb-tags">
              {coach.topics.map((t) => (
                <Link key={t} href={`/coaches?topic=${encodeURIComponent(t)}`} className="et-tag">
                  {t}
                </Link>
              ))}
            </div>
          )}
          {coach.bio && (
            <div className="et-cb-bio">
              <h2>About</h2>
              {coach.bio.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
          <div className="et-cb-how">
            <h2>How it works</h2>
            <ol>
              <li>Pick a time that suits you and pay to confirm it.</li>
              <li>Tell your coach what you&apos;d like to cover so they can prepare.</li>
              <li>Join the video call from your Sessions page. We&apos;ll remind you an hour before.</li>
            </ol>
          </div>
        </div>
        <BookingPanel
          slug={coach.slug}
          slots={coach.days.flatMap((d) => d.slots)}
          minutes={coach.session_minutes}
          priceMinor={coach.price_minor}
          currency={coach.currency}
          signedIn={!!viewer}
          walletMinor={wallet}
          isSelf={isSelf}
        />
      </div>
    </section>
  );
}
