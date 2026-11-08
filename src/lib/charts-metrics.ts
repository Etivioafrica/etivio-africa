// Chart list shared by the admin sidebar and the Charts page (safe to import in client code).
export const METRICS = [
  { key: "revenue", group: "Money", label: "Revenue", kind: "money", desc: "Successful payments (gross, before the tutor share)." },
  { key: "platform", group: "Money", label: "Platform earnings", kind: "money", desc: "Etivio's commission from successful payments. This is what Etivio keeps." },
  { key: "tutor_share", group: "Money", label: "Tutor earnings", kind: "money", desc: "The tutors' share of successful payments." },
  { key: "orders", group: "Money", label: "Paid orders", kind: "count", desc: "Checkouts that were paid." },
  { key: "aov", group: "Money", label: "Average order value", kind: "money", desc: "Revenue divided by paid orders." },
  { key: "checkout_conv", group: "Money", label: "Checkout conversion", kind: "percent", desc: "Share of started checkouts that were paid." },
  { key: "customers", group: "Money", label: "Paying customers", kind: "count", desc: "Different people who paid in each period." },
  { key: "arppu", group: "Money", label: "Revenue per customer", kind: "money", desc: "Revenue divided by paying customers." },
  { key: "rev_per_signup", group: "Money", label: "Revenue per new sign-up", kind: "money", desc: "Revenue divided by new sign-ups in the same period. A rough value of each new user." },
  { key: "refunds", group: "Money", label: "Refunds", kind: "money", desc: "Payments marked refunded." },
  { key: "signups", group: "Growth", label: "New sign-ups", kind: "count", desc: "New accounts created." },
  { key: "visitors", group: "Growth", label: "Visitors", kind: "count", desc: "Different visitors to the site." },
  { key: "signup_conv", group: "Growth", label: "Visitor to sign-up", kind: "percent", desc: "New sign-ups divided by visitors." },
  { key: "enrollments", group: "Growth", label: "New enrolments", kind: "count", desc: "Course enrolments started (free and paid)." },
  { key: "active", group: "Learning", label: "Active learners", kind: "count", desc: "Different people who finished at least one lesson." },
  { key: "lessons", group: "Learning", label: "Lessons completed", kind: "count", desc: "Lessons marked complete." },
  { key: "completions", group: "Learning", label: "Courses completed", kind: "count", desc: "Enrolments that reached the end of the course." },
  { key: "certificates", group: "Learning", label: "Certificates issued", kind: "count", desc: "Certificates awarded, revoked ones included." },
] as const;
export type MetricKey = (typeof METRICS)[number]["key"];
