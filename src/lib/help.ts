// Help centre content. Plain strings so the page can search them and publish FAQ structured data.

export const CONTACT_TOPICS = ["General question", "Payment or refund", "Downloads or access", "Teaching on Etivio", "Partnerships", "Report a problem"] as const;

export type HelpTopic = { id: string; title: string; blurb: string; faqs: { q: string; a: string }[] };

export const HELP: HelpTopic[] = [
  {
    id: "getting-started",
    title: "Getting started",
    blurb: "Your account, the dashboard and finding something to learn.",
    faqs: [
      { q: "Is Etivio free to join?", a: "Yes. Creating an account is free, and many courses and resources are free too. You only pay for paid items you choose to buy." },
      { q: "How do I create an account?", a: "Click Get started, enter your name, email and a password, then confirm your email from the message we send you. You'll land on your learning dashboard." },
      { q: "I didn't get the confirmation email.", a: "Check your spam or promotions folder for an email from support@etivio.co. If it isn't there after a few minutes, try signing up again with the same email or contact us." },
      { q: "How do I find courses and resources?", a: "Open Explore to search everything on Etivio. Filter by type (courses, templates, e-books, resource packs, bundles), category and price, or sort by popular, newest, rating or price." },
      { q: "Can I use Etivio on my phone?", a: "Yes. Etivio works in any modern mobile browser, so there's nothing to install. Your progress syncs between your phone and computer." },
    ],
  },
  {
    id: "learning",
    title: "Courses and certificates",
    blurb: "Lessons, progress, quizzes and certificates.",
    faqs: [
      { q: "How long do I have access to a course?", a: "For as long as Etivio is running. Once you enrol, the course stays in My courses and you can come back to it any time." },
      { q: "How is my progress saved?", a: "Mark each lesson complete as you finish it. Your dashboard shows how far you've got, how much is left, and where to pick up next." },
      { q: "What are module quizzes?", a: "Some courses end a module with a short quiz. Pass it to unlock the next module. You can retake a quiz if you don't pass the first time." },
      { q: "How do I get a certificate?", a: "Complete every lesson in a course and your certificate is issued automatically. You'll get an email, and it appears on your profile under Certificates." },
      { q: "How can an employer check my certificate?", a: "Every certificate has an ID. Anyone can enter it at etivio.co/certificate to confirm it's genuine and see who earned it and for which course." },
      { q: "Can I leave a review?", a: "Yes, once you're 30% of the way through a course. Reviews appear after a quick check by the Etivio team." },
    ],
  },
  {
    id: "payments",
    title: "Buying and payments",
    blurb: "Paying for courses and resources, receipts and refunds.",
    faqs: [
      { q: "How do I pay?", a: "Click Buy now on any paid course or product. You'll be taken to Paystack's secure checkout, where you can pay by card, bank transfer or USSD. Prices are in naira." },
      { q: "Is it safe to pay on Etivio?", a: "Yes. Payments are handled by Paystack, and your card details never touch Etivio's servers. We only give you access once Paystack confirms the payment." },
      { q: "I paid but I can't see my purchase.", a: "Access is usually instant. If you closed the page before it finished, refresh your Library or My courses after a minute. Still missing? Contact us with your payment reference from the Paystack email." },
      { q: "Do I get a receipt?", a: "Yes. A receipt with the amount, reference and date is emailed to you as soon as the payment goes through." },
      { q: "Can I get a refund?", a: "Courses can be refunded within 14 days if you've completed less than 30% of them. Downloadable items can be refunded within 14 days if you haven't downloaded them, or if a file is faulty. See the refund policy for details." },
      { q: "My payment failed. Was I charged?", a: "If Paystack declines a payment you aren't charged, and you'll be sent back to the page with a message. If money left your account but the order shows as failed, contact us with the reference and we'll check it with Paystack." },
    ],
  },
  {
    id: "downloads",
    title: "Downloads and your library",
    blurb: "Templates, e-books, resource packs and bundles.",
    faqs: [
      { q: "Where are the files I bought?", a: "Open Library from the sidebar in your dashboard. Every template, e-book and resource pack you own is there, each with a Download button." },
      { q: "Can I download a file more than once?", a: "Yes. Your purchases stay in your Library and you can download them again whenever you need to." },
      { q: "Why did my download link stop working?", a: "For security, each download link expires after a few minutes. Just click Download in your Library again to get a fresh one." },
      { q: "What do I get in a bundle?", a: "Everything listed on the bundle's page. Courses in a bundle appear in My courses, and the files appear in your Library." },
      { q: "Can I share files I bought?", a: "Purchases are for your own use. Please don't resell or share them publicly, so creators can keep making them." },
      { q: "How do I save something for later?", a: "Click Save for later on any course or product page. You'll find everything you've saved under Saved in your dashboard." },
    ],
  },
  {
    id: "teaching",
    title: "Teaching and selling",
    blurb: "Becoming a tutor, publishing and getting paid.",
    faqs: [
      { q: "How do I become a tutor?", a: "Go to Teach on Etivio, sign in, and tell us what you'd like to teach and your experience. The Etivio team reviews every application and emails you the outcome." },
      { q: "What can I sell?", a: "Courses, templates, e-books and guides, resource packs, and bundles that combine them. Each one is reviewed before it goes live." },
      { q: "Why does my product need a review?", a: "Every item is checked before it appears on the marketplace, and editing a live item sends it back for a quick check. If changes are needed, you'll see the team's note in the editor." },
      { q: "How much do I earn?", a: "You set your price and keep the sale price minus Etivio's commission. Your Earnings page shows every sale, your share, and what's been paid out." },
      { q: "How do I get paid?", a: "Add your bank account under Settings, then Billing. We check it with Paystack and pay your earnings out to it." },
    ],
  },
  {
    id: "account",
    title: "Account and security",
    blurb: "Sign-in, profile, privacy and deleting your account.",
    faqs: [
      { q: "I forgot my password.", a: "Click Forgot password on the log-in page and we'll email you a link to set a new one." },
      { q: "How do I turn on two-step verification?", a: "Go to Settings, then Security, and set up an authenticator app. You'll be asked for a code each time you sign in." },
      { q: "Can I make my profile public?", a: "Yes. Choose a username in Settings and switch your profile to public. It will live at etivio.co/@yourname with your certificates and badges." },
      { q: "Can I control the emails I get?", a: "Yes. Under Settings, then Notifications, you can turn course updates, support replies and Etivio news on or off. Account emails like receipts always send." },
      { q: "How do I download my data?", a: "Go to Settings, then Account, and click Export your data to download everything we hold about you as a file." },
      { q: "How do I delete my account?", a: "Go to Settings, then Account. Your account is closed straight away, and you have 30 days to change your mind before it's deleted for good." },
    ],
  },
];
