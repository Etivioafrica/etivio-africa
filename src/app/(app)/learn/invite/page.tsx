import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BadgePercent, Gift, Share2, ShoppingBag, UserPlus, Users, Wallet } from "lucide-react";
import { Avatar } from "@/components/dash/Avatar";
import { PageHead, StatStrip } from "@/components/dash/ui";
import { getCurrentUser } from "@/lib/auth";
import { featureOn } from "@/lib/data/features";
import { inviteUrl, myReferrals, referralTerms } from "@/lib/data/referrals";
import { formatDate, formatMoney } from "@/lib/format";
import { InviteShare } from "./InviteShare";

export const metadata = { title: "Invite friends" };

export default function InvitePage() {
  return (
    <div className="et-page">
      <PageHead title="Invite friends" sub="Share your link. When a friend buys their first course, you both get wallet credit to spend on courses." />
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  // Only while Invite friends is on (Settings → Features).
  if (!(await featureOn("referrals"))) notFound();
  const user = await getCurrentUser();
  const [r, terms] = await Promise.all([myReferrals(user.id), referralTerms()]);
  const url = inviteUrl(r.code);
  const cap = formatMoney(terms.capMinor);

  return (
    <>
      <div className="et-wl-grid">
        <section className="et-wl-card et-inv-card">
          <div className="et-wl-card-top">
            <span className="et-wl-icon">
              <Gift size={20} />
            </span>
            <span className="et-wl-brand">Invite and earn</span>
          </div>
          <b className="et-inv-headline">Get {terms.percent}% of your friend&apos;s first course</b>
          <small>Up to {cap} per friend, straight into your Etivio wallet.{terms.friendPercent > 0 ? ` They get ${terms.friendPercent}% back too.` : ""}</small>
          <InviteShare url={url} message="I'm learning on Etivio. Join me with my link:" />
        </section>
        <section className="et-card et-card-pad">
          <h2 className="et-inv-how-title">How it works</h2>
          <ol className="et-inv-steps">
            <li>
              <span>
                <Share2 size={16} />
              </span>
              <div>
                <b>Share your link</b>
                <small>Send it on WhatsApp, X or anywhere. Any Etivio page link with <b className="et-inv-code">?ref={r.code}</b> works too.</small>
              </div>
            </li>
            <li>
              <span>
                <UserPlus size={16} />
              </span>
              <div>
                <b>Your friend signs up</b>
                <small>They create a free account through your link. You&apos;ll get a notification.</small>
              </div>
            </li>
            <li>
              <span>
                <Wallet size={16} />
              </span>
              <div>
                <b>You both earn</b>
                <small>
                  When they buy their first course within {terms.days} days, you get {terms.percent}% of what they paid{terms.friendPercent > 0 ? ` and they get ${terms.friendPercent}% back` : ""}.
                </small>
              </div>
            </li>
          </ol>
        </section>
      </div>

      <StatStrip
        items={[
          { label: "Friends joined", value: r.friends.length, icon: Users },
          { label: "Bought a course", value: r.bought, icon: ShoppingBag },
          { label: "You've earned", value: formatMoney(r.earnedMinor), icon: Wallet, href: "/learn/wallet" },
          { label: "Your reward", value: `${terms.percent}%`, icon: BadgePercent, hint: `Up to ${cap} per friend` },
        ]}
      />

      <section className="et-card" style={{ marginTop: 16 }}>
        <div className="et-card-head">
          <h2>Friends you invited</h2>
        </div>
        {r.friends.length ? (
          <ul className="et-wl-history">
            {r.friends.map((f) => (
              <li key={f.id}>
                <Avatar src={f.avatarUrl} initial={f.name.charAt(0).toUpperCase()} seed={f.seed} className="et-inv-avatar" />
                <span className="et-wl-what">
                  <b>{f.name}</b>
                  <small>Joined {formatDate(f.joinedAt)}</small>
                </span>
                {f.earnedMinor > 0 ? <b className="et-wallet-in">+{formatMoney(f.earnedMinor)}</b> : <span className="et-inv-wait">Not bought yet</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="et-card-pad et-muted">No one yet. Friends who sign up with your link show up here.</p>
        )}
      </section>
    </>
  );
}
