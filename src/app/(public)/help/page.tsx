import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, ReceiptText } from "lucide-react";
import { HELP } from "@/lib/help";
import { HelpCentre } from "./HelpCentre";

export const metadata: Metadata = {
  title: "Help centre | Etivio",
  description: "Answers about Etivio courses, certificates, payments, downloads, teaching and your account.",
  alternates: { canonical: "/help" },
};

// FAQ structured data so search engines can show answers directly.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HELP.flatMap((t) => t.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))),
};

export default function HelpPage() {
  return (
    <div className="et-mkt">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
      <HelpCentre topics={HELP} />

      <section className="et-mkt-links is-2">
        <Link href="/contact" className="et-card et-card-pad et-mkt-help-card">
          <MessageCircle size={20} />
          <div>
            <b>Still need help?</b>
            <small>Send the Etivio team a message and we&apos;ll get back to you.</small>
          </div>
        </Link>
        <Link href="/refund-policy" className="et-card et-card-pad et-mkt-help-card">
          <ReceiptText size={20} />
          <div>
            <b>Refund policy</b>
            <small>When and how you can get your money back.</small>
          </div>
        </Link>
      </section>
    </div>
  );
}
