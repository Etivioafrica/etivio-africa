import Link from "next/link";

export const metadata = { title: "Terms of Service | Etivio" };

const CONTACT = "etivio.co@gmail.com";

export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="et-legal-date">Last updated: 18 October 2026</p>

      <p>
        These terms govern your use of etivio.co and the services run by Etivio Africa (&quot;Etivio&quot;, &quot;we&quot;,
        &quot;us&quot;). By creating an account or using Etivio, you agree to these terms and to our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>1. Your account</h2>
      <ul>
        <li>You must be at least 13 years old to use Etivio. If you are under 18, you need permission from a parent or guardian.</li>
        <li>Give accurate information and keep your password secure. You are responsible for activity on your account.</li>
        <li>Tell us straight away if you think someone else has accessed your account.</li>
      </ul>

      <h2>2. Learning on Etivio</h2>
      <p>
        When you enrol in a course, you get a personal, non-transferable right to view it for your own learning. You may not
        copy, share, resell, or publicly redistribute course content, or share your account to give others access.
      </p>

      <h2>3. Teaching on Etivio</h2>
      <ul>
        <li>Instructor accounts are subject to approval. We may approve, decline, or remove instructor access.</li>
        <li>
          You keep ownership of the content you publish. You give Etivio a licence to host, display, and promote it on the
          platform so we can deliver it to students.
        </li>
        <li>
          You confirm you have the rights to everything you upload, and that it does not infringe anyone else&apos;s
          intellectual property or break the law.
        </li>
        <li>
          For paid courses, Etivio keeps a platform commission and pays out the rest under the payout terms shown in your
          dashboard.
        </li>
      </ul>

      <h2>4. Payments and refunds</h2>
      <p>
        Prices are shown in naira before you pay. Payments are handled by our payment provider, Paystack, and access is granted once
        the payment is confirmed. Refunds follow our <Link href="/refund-policy">Refund Policy</Link>.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Upload anything unlawful, harmful, hateful, sexually explicit, or misleading.</li>
        <li>Harass, threaten, or impersonate other people.</li>
        <li>Try to break, overload, or bypass the security of the platform.</li>
        <li>Scrape, download, or record content in ways the platform does not allow.</li>
      </ul>

      <h2>6. Suspension and termination</h2>
      <p>
        We may suspend or close accounts that break these terms or put other users at risk. You can stop using Etivio at any
        time and ask us to delete your account.
      </p>

      <h2>7. Our content and brand</h2>
      <p>
        The Etivio name, logo, and platform design belong to Etivio Africa. You may not use them without our written
        permission.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        Courses are created by independent instructors. We work to keep quality high, but we do not guarantee any particular
        result, job, or qualification from taking a course. Etivio is provided &quot;as is&quot; and may sometimes be unavailable
        for maintenance or reasons beyond our control.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the extent the law allows, Etivio is not liable for indirect or consequential losses. Our total liability to you for
        any claim is limited to the amount you paid us in the 12 months before the claim.
      </p>

      <h2>10. Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms. If the changes are significant, we will update the date above and let you know. Continuing
        to use Etivio after that means you accept the new terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </article>
  );
}
