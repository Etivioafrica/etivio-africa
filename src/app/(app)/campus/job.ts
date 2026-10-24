// Shared by the server and the browser: details on an Opportunity post, and the card for a web link in a post.

export type CampusLink = { url: string; title: string; description: string; image: string; site: string };

export type JobPay = "paid" | "internship" | "scholarship" | "volunteer" | "collab" | "equity";
export type JobType = "full_time" | "part_time" | "contract" | "freelance" | "gig";
export type CampusJob = {
  pay: JobPay;
  title: string;
  company: string;
  salary: string;
  location: string;
  remote: boolean;
  type: JobType | "";
  email: string;
  url: string;
};

export const JOB_PAY: { value: JobPay; label: string; hint: string; color: string }[] = [
  { value: "paid", label: "Paid", hint: "Salary or rate", color: "#16a34a" },
  { value: "internship", label: "Internship", hint: "Learn on the job", color: "#ea580c" },
  { value: "scholarship", label: "Scholarship", hint: "Funding or a grant", color: "#2563eb" },
  { value: "volunteer", label: "Volunteer", hint: "Unpaid, for good", color: "#0891b2" },
  { value: "collab", label: "Collaboration", hint: "Partner or revenue share", color: "#7c3aed" },
  { value: "equity", label: "Equity", hint: "A stake in the business", color: "#d97706" },
];

export const JOB_TYPE: { value: JobType; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
  { value: "gig", label: "One-off gig" },
];

export const EMPTY_JOB: CampusJob = { pay: "paid", title: "", company: "", salary: "", location: "", remote: false, type: "", email: "", url: "" };

// The first web link in some text (what the link card is made from).
export const firstLink = (text: string) => text.match(/https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/)?.[0] ?? null;
