// Feature switches: every feature that can be turned off or launched to staff first. Admins change them in
// Settings → Features (stored in feature_flags); anything never changed uses `initial`.

export type FeatureStatus = "off" | "staff" | "on";

export const FEATURES = {
  group_buy: { label: "Group buy", description: "Buy a course with friends at a discount. Turning it off hides the course-page box and group pages; open groups still finish.", initial: "on" },
  wallet: { label: "Wallet and top-ups", description: "Learners' wallet page and Paystack top-ups. Existing balances are still used at checkout when off.", initial: "on" },
  messages: { label: "Student-tutor messages", description: "Private chat between enrolled students and their tutor, and the Messages inboxes.", initial: "on" },
  ai_assistant: { label: "Etivio AI assistant", description: "The floating AI helper in the app.", initial: "on" },
  ai_course_tools: { label: "AI course tools", description: "AI suggestions while creating courses and products: outlines, descriptions, lesson notes and covers.", initial: "on" },
  ai_lesson: { label: "Ask AI in lessons", description: "The Ask AI tab in the course player.", initial: "on" },
  withdrawals: { label: "Tutor withdrawals", description: "Tutors request payouts from Earnings. When off, they only see their earnings.", initial: "on" },
  coaching: { label: "Coaches and booking", description: "Coach profiles, booking and paying for 1-on-1 sessions, and the coach tools in Teach.", initial: "off" },
  campus: { label: "Campus", description: "The shared feed where learners post updates, questions, wins, polls and opportunities.", initial: "on" },
  communities: { label: "Communities", description: "Community spaces, posts and join approval. Coming soon.", initial: "off" },
} satisfies Record<string, { label: string; description: string; initial: FeatureStatus }>;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];
export type FeatureMap = Record<FeatureKey, boolean>;
