import Link from "next/link";

export const metadata = { title: "Privacy Policy | Etivio" };

const CONTACT = "etivio.co@gmail.com";

export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="et-legal-date">Last updated: 18 October 2026</p>

      <p>
        Etivio Africa (&quot;Etivio&quot;, &quot;we&quot;, &quot;us&quot;) runs etivio.co, an online learning platform where students take
        courses and instructors publish them. This policy explains what personal data we collect, why we collect it, and the
        choices you have. We handle personal data in line with the Nigeria Data Protection Act 2023 and other laws that apply
        to you.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, and password (stored only as a secure hash). If you sign
          in with Google, we receive your name, email address, and profile picture from Google. We do not receive your Google
          password.
        </li>
        <li>
          <strong>Profile details you add:</strong> such as a bio, photo, and the roles you apply for (for example, tutor).
        </li>
        <li>
          <strong>Learning activity:</strong> the courses you enrol in, lessons you complete, and your progress.
        </li>
        <li>
          <strong>Content you upload:</strong> course materials, videos, images, documents, and messages you send to support.
        </li>
        <li>
          <strong>Payment details:</strong> when you pay for a course or receive instructor payouts, payments are processed by
          our payment provider. We keep a record of the transaction, but we do not store your full card details.
        </li>
        <li>
          <strong>Technical data:</strong> basic device and usage information, such as pages visited and sign-in times, used to
          keep the service secure and working.
        </li>
      </ul>

      <h2>2. How we use your data</h2>
      <ul>
        <li>To create and secure your account and sign you in.</li>
        <li>To deliver courses, track your progress, and show instructors how their students are doing.</li>
        <li>To process payments, instructor payouts, and commissions.</li>
        <li>To answer support requests and send important account emails, such as confirmations and password resets.</li>
        <li>To prevent fraud and abuse, and to meet our legal obligations.</li>
      </ul>
      <p>We do not sell your personal data, and we do not use it for third-party advertising.</p>

      <h2>3. Who we share it with</h2>
      <p>We share data only with service providers that help us run Etivio, and only as much as they need:</p>
      <ul>
        <li>
          <strong>Supabase</strong> for accounts, sign-in, and our database.
        </li>
        <li>
          <strong>Cloudflare</strong> for storing uploaded files such as course videos and images.
        </li>
        <li>
          <strong>Vercel</strong> for hosting the website.
        </li>
        <li>
          <strong>Google</strong> if you choose to sign in with Google.
        </li>
        <li>
          <strong>Our payment provider</strong> for processing payments and payouts.
        </li>
      </ul>
      <p>
        Instructors can see the name and course progress of students enrolled in their courses. We may also disclose data
        where the law requires it.
      </p>

      <h2>4. International transfers</h2>
      <p>
        Some of our providers store data outside Nigeria, including in the European Union and the United States. When this
        happens, we rely on providers that apply recognised safeguards to protect your data.
      </p>

      <h2>5. Cookies and local storage</h2>
      <p>
        We use essential cookies to keep you signed in. We also save small preferences in your browser, such as light or dark
        mode. We do not use advertising cookies.
      </p>

      <h2>6. How long we keep it</h2>
      <p>
        We keep your data while your account is active. If your account is deleted, we can restore it for 30 days, after which
        your personal data is permanently removed, except records we must keep by law, such as payment records.
      </p>

      <h2>7. Your rights</h2>
      <p>
        You can ask to access, correct, download, or delete your personal data, object to how we use it, or withdraw consent
        where we rely on it. You can update most profile details yourself in Settings. For anything else, email us at{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. You may also complain to the Nigeria Data Protection Commission.
      </p>

      <h2>8. Security</h2>
      <p>
        We protect data with encryption in transit, hashed passwords, and access controls that limit who can see what. No
        system is perfectly secure, so please use a strong password and keep it private.
      </p>

      <h2>9. Children</h2>
      <p>
        Etivio is not intended for children under 13. If you believe a child has given us personal data, contact us and we will
        remove it.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        If we make significant changes, we will update the date above and let you know by email or on the site. Please also
        read our <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about privacy? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </article>
  );
}
