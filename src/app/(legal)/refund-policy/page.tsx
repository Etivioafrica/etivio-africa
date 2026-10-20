import Link from "next/link";

export const metadata = {
  title: "Refund Policy | Etivio",
  description: "When and how you can get a refund for courses, templates, e-books, resource packs and bundles bought on Etivio.",
  alternates: { canonical: "/refund-policy" },
};

const CONTACT = "etivio.co@gmail.com";

export default function RefundPolicyPage() {
  return (
    <article>
      <h1>Refund Policy</h1>
      <p className="et-legal-date">Last updated: 20 October 2026</p>

      <p>
        We want you to be happy with everything you buy on Etivio. This policy explains when you can get your money back. It is part of
        our <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>1. Courses</h2>
      <p>You can ask for a full refund on a course within 14 days of buying it, as long as you have completed less than 30% of its lessons.</p>

      <h2>2. Templates, e-books and resource packs</h2>
      <p>Because these are files you keep once downloaded, you can ask for a full refund within 14 days of buying if:</p>
      <ul>
        <li>you haven&apos;t downloaded any of its files yet, or</li>
        <li>a file is broken, won&apos;t open, or is clearly not what the product page described. We may first try to fix it or send you a working copy.</li>
      </ul>

      <h2>3. Bundles</h2>
      <p>
        A bundle can be refunded within 14 days if you haven&apos;t downloaded any of its files and have completed less than 30% of each
        course in it. Bundles are refunded as a whole, not item by item.
      </p>

      <h2>4. When we can&apos;t refund</h2>
      <ul>
        <li>Requests made more than 14 days after purchase, unless the item was faulty or not as described.</li>
        <li>Accounts suspended for breaking our terms, for example by sharing or reselling purchased content.</li>
        <li>Repeated refund requests that suggest the policy is being misused.</li>
        <li>Free items, since nothing was paid.</li>
      </ul>

      <h2>5. How to ask for a refund</h2>
      <p>
        <Link href="/contact">Contact us</Link> and choose &quot;Payment or refund&quot;, or email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        Include the email on your Etivio account and the payment reference from your receipt. We reply within two working days.
      </p>

      <h2>6. How refunds are paid</h2>
      <p>
        Approved refunds go back to the card or account you paid with, through our payment provider Paystack. Paystack says refunds
        usually arrive within 3 to 10 working days, depending on your bank. We refund the full amount you paid. Once a refund is made,
        access to the course or files is removed.
      </p>

      <h2>7. For tutors and creators</h2>
      <p>
        When a sale is refunded, the creator&apos;s share of it is reversed. If that share was already paid out, it is deducted from the
        creator&apos;s next payout.
      </p>

      <h2>8. Your legal rights</h2>
      <p>This policy doesn&apos;t limit any rights you have under consumer protection law in Nigeria or where you live.</p>
    </article>
  );
}
