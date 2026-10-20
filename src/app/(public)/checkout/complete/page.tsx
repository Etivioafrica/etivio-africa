import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, FolderDown, Inbox, KeyRound, MousePointerClick } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sessionUser } from "@/lib/supabase/session";
import { ClearCart } from "./ClearCart";

export const metadata = { title: "Payment received | Etivio", robots: { index: false } };

type Props = { searchParams: Promise<{ email?: string; order?: string }> };

// Where guests land after paying. They aren't signed in, so this points them to the email with their login.
export default function CheckoutComplete({ searchParams }: Props) {
  return (
    <section className="et-mkt-hero et-checkout-done">
      <ClearCart />
      <span className="et-cta-icon is-ok">
        <CheckCircle2 size={26} />
      </span>
      <h1>Payment received. You&apos;re in!</h1>
      <Suspense fallback={<p>We&apos;ve emailed your receipt.</p>}>
        <NextSteps searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

// Signed-in buyers go straight to their purchases; guests are pointed to the email with their login.
async function NextSteps({ searchParams }: Props) {
  const viewer = await sessionUser(await createClient());
  if (viewer)
    return (
      <>
        <p>Your receipt is on its way to <b>{viewer.email}</b>. Everything you bought is ready in your account.</p>
        <div className="et-home-ctas">
          <Link href="/learn/courses" className="et-btn et-btn-primary et-home-btn">
            <BookOpen size={16} /> My courses
          </Link>
          <Link href="/learn/library" className="et-btn et-btn-ghost et-home-btn">
            <FolderDown size={16} /> My library
          </Link>
        </div>
      </>
    );
  return (
    <>
      <SentTo searchParams={searchParams} />
      <ol className="et-checkout-steps">
        <li>
          <Inbox size={18} />
          <span>
            <b>Open the email from Etivio</b>
            <small>It can take a minute. Check spam or promotions if you don&apos;t see it.</small>
          </span>
        </li>
        <li>
          <MousePointerClick size={18} />
          <span>
            <b>Tap &quot;Go to my purchase&quot;</b>
            <small>It signs you straight in for the next hour.</small>
          </span>
        </li>
        <li>
          <KeyRound size={18} />
          <span>
            <b>Choose your own password</b>
            <small>Then sign in any time at etivio.co with your email.</small>
          </span>
        </li>
      </ol>
      <div className="et-home-ctas">
        <Link href="/login" className="et-btn et-btn-primary et-home-btn">
          Log in
        </Link>
        <Link href="/contact" className="et-btn et-btn-ghost et-home-btn">
          No email? Contact us
        </Link>
      </div>
    </>
  );
}

async function SentTo({ searchParams }: Props) {
  const { email } = await searchParams;
  const shown = email && /^[^\s<>]{1,80}@[^\s<>]{1,120}$/.test(email) ? email : null;
  return <p>{shown ? <>We&apos;ve emailed your login details to <b>{shown}</b>.</> : <>We&apos;ve emailed your login details to the address you gave us.</>}</p>;
}
