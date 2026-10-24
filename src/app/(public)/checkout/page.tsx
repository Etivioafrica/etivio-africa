import { Suspense } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionUser } from "@/lib/supabase/session";
import { walletBalance } from "@/lib/data/wallet";
import { CheckoutForm, type Prefill } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout | Etivio", robots: { index: false } };

type Props = { searchParams: Promise<{ coupon?: string }> };

export default function CheckoutPage({ searchParams }: Props) {
  return (
    <div className="et-mkt">
      <section className="et-mkt-hero is-tight et-shop-hero">
        <h1>Checkout</h1>
      </section>
      <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
        <Checkout searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Signed-in buyers start with their name, email and saved billing country filled in. A ?coupon= code from a shared
// link is applied once the cart is priced.
async function Checkout({ searchParams }: Props) {
  const { coupon } = await searchParams;
  const viewer = await sessionUser(await createClient());
  let prefill: Prefill | null = null;
  let wallet = 0;
  if (viewer) {
    wallet = await walletBalance(viewer.id);
    const db = createAdminClient();
    const [{ data: profile }, { data: billing }] = await Promise.all([
      db.from("profiles").select("full_name").eq("id", viewer.id).maybeSingle(),
      db.from("billing_details").select("name, country, city").eq("user_id", viewer.id).maybeSingle(),
    ]);
    const [first = "", ...rest] = (billing?.name || profile?.full_name || "").trim().split(/\s+/);
    prefill = { firstName: first, lastName: rest.join(" "), email: viewer.email, country: billing?.country ?? "", state: billing?.city ?? "" };
  }
  return <CheckoutForm prefill={prefill} walletMinor={wallet} initialCoupon={(coupon ?? "").slice(0, 32).toUpperCase()} />;
}
