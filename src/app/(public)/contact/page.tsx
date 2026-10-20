import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Mail, MessageCircle, MessagesSquare } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/dash/ActionForm";
import { CONTACT_TOPICS } from "@/lib/help";
import { getPlatformSettings, whatsappLink } from "@/lib/platform";
import { sendContactMessage } from "./actions";
import { Select } from "@/components/dash/Select";

export const metadata: Metadata = {
  title: "Contact Etivio",
  description: "Questions about a course, a payment or teaching on Etivio? Send us a message and the team will get back to you.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="et-mkt">
      <section className="et-mkt-hero is-tight">
        <h1>Contact us</h1>
        <p>Questions about a course, a payment or teaching on Etivio? Send us a message and we&apos;ll get back to you, usually within one working day.</p>
      </section>

      <div className="et-mkt-contact">
        <section className="et-card">
          <div className="et-card-head">
            <h2>Send a message</h2>
          </div>
          <ActionForm action={sendContactMessage} className="et-form et-card-pad">
            <div className="et-form-grid">
              <div className="et-field">
                <label htmlFor="c-name">Your name</label>
                <input id="c-name" name="name" required minLength={2} maxLength={100} autoComplete="name" />
              </div>
              <div className="et-field">
                <label htmlFor="c-email">Email</label>
                <input id="c-email" name="email" type="email" required maxLength={200} autoComplete="email" />
              </div>
              <div className="et-field">
                <label htmlFor="c-topic">Topic</label>
                <Select id="c-topic" name="topic" defaultValue={CONTACT_TOPICS[0]}>
                  {CONTACT_TOPICS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </div>
              <div className="et-field">
                <label htmlFor="c-ref">Payment reference (optional)</label>
                <input id="c-ref" name="reference" maxLength={80} placeholder="For payment questions, e.g. ET4F2A…" />
              </div>
              <div className="et-field et-field-wide">
                <label htmlFor="c-message">Message</label>
                <textarea id="c-message" name="message" rows={6} required minLength={10} maxLength={5000} />
              </div>
            </div>
            {/* Hidden from people; bots fill it in. */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="et-hp" />
            <div>
              <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
            </div>
          </ActionForm>
        </section>

        <aside className="et-mkt-channels">
          <Suspense fallback={<div className="et-skel" style={{ height: 140 }} />}>
            <Channels />
          </Suspense>
          <Link href="/support" className="et-card et-card-pad et-mkt-help-card">
            <MessagesSquare size={20} />
            <div>
              <b>Chat with support</b>
              <small>Signed in? Start a live chat with the team from your dashboard.</small>
            </div>
          </Link>
          <Link href="/help" className="et-card et-card-pad et-mkt-help-card">
            <BookOpen size={20} />
            <div>
              <b>Help centre</b>
              <small>Quick answers about payments, downloads and certificates.</small>
            </div>
          </Link>
        </aside>
      </div>
    </div>
  );
}

// Email and WhatsApp from Admin > Settings > Platform.
async function Channels() {
  const s = await getPlatformSettings();
  const email = s.supportEmail || "etivio.co@gmail.com";
  return (
    <>
      <a href={`mailto:${email}`} className="et-card et-card-pad et-mkt-help-card">
        <Mail size={20} />
        <div>
          <b>Email</b>
          <small>{email}</small>
        </div>
      </a>
      {s.supportWhatsapp && (
        <a href={whatsappLink(s.supportWhatsapp)} target="_blank" rel="noopener noreferrer" className="et-card et-card-pad et-mkt-help-card">
          <MessageCircle size={20} />
          <div>
            <b>WhatsApp</b>
            <small>{s.supportWhatsapp}</small>
          </div>
        </a>
      )}
    </>
  );
}
