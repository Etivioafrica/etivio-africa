import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { CouponForm } from "../CouponForm";
import { pickableItems } from "../data";

export const metadata = { title: "New coupon" };

export default function NewCouponPage() {
  return (
    <div className="et-page">
      <Link href="/admin/coupons" className="et-back">
        <ArrowLeft size={15} /> Coupons
      </Link>
      <div className="et-page-head">
        <div>
          <h1>New coupon</h1>
          <p>A discount code for checkout. Keep it open to anyone, or only to the people you list.</p>
        </div>
      </div>
      <Suspense fallback={<div className="et-skel" style={{ height: 640 }} />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  await requireAdmin("coupons");
  return <CouponForm coupon={null} items={await pickableItems()} />;
}
