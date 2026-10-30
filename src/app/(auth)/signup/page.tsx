import { Suspense } from "react";
import { AuthForm } from "../AuthForm";
import { inviterFromCookie } from "@/lib/data/referrals";

export const metadata = { title: "Create account | Etivio" };

// The form shows straight away; who sent the invite (from the cookie) streams in a moment later.
export default function SignupPage() {
  return (
    <Suspense fallback={<AuthForm mode="signup" />}>
      <WithInvite />
    </Suspense>
  );
}

async function WithInvite() {
  return <AuthForm mode="signup" invite={await inviterFromCookie()} />;
}
