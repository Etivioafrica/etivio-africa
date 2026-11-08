import { FaqBlock, type FaqItem } from "@/components/faq/FaqBlock";

export const metadata = { title: "FAQs" };

const ITEMS: FaqItem[] = [
  {
    q: "How do I start a course?",
    a: "Open Browse courses, pick a course and press Enrol. Free courses open straight away. For paid courses you pay first, then the course appears in My courses.",
  },
  {
    q: "My payment went through but the course is not showing. What do I do?",
    a: "Payments can take a minute to confirm. Refresh My courses. If it still is not there after a few minutes, message support with your payment reference from the receipt email and we will sort it out.",
  },
  {
    q: "How does the AI tutor work?",
    a: "Open any lesson and choose the Ask AI tab. It knows the course you are taking and the lesson you are on, explains ideas in plain English and can quiz you. You can ask up to 40 questions a day.",
  },
  {
    q: "How do I get my certificate?",
    a: "Finish every lesson in the course and your certificate is issued automatically. You will find it on your profile, with a link anyone can use to check that it is real. Add that link to your CV or LinkedIn.",
  },
  {
    q: "Does my progress save if I switch devices?",
    a: "Yes. Your progress, notes and saved items are tied to your account, so you can start on your phone and carry on from your laptop.",
  },
  {
    q: "Can I ask my tutor a question directly?",
    a: "Yes. Use Messages to write to the tutor of a course you are enrolled in. They will reply there, and you get a notification when they do.",
  },
  {
    q: "How long do I keep access to a course?",
    a: "Each course shows its access period on its page before you enrol. Many give lifetime access, and some give access for a set number of months.",
  },
  {
    q: "How do I change my email, password or notifications?",
    a: "Go to Settings. You can update your details, change your password, turn on two-step sign-in and choose which emails and reminders you get.",
  },
];

export default function LearnFaq() {
  return (
    <div className="et-page">
      <section className="et-card" style={{ padding: "clamp(24px,4vw,56px)" }}>
        <FaqBlock
          title={["Have questions?", "Find answers."]}
          items={ITEMS}
          name="learn-faq"
          more={{ title: "Have more questions?", body: "Reach out to our friendly support team.", href: "/support", label: "Message support" }}
        />
      </section>
    </div>
  );
}
