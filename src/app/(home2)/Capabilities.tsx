import {
  Award,
  BellRing,
  CheckCircle2,
  CalendarDays,
  CreditCard,
  FileText,
  Landmark,
  Laptop,
  Mail,
  MessageCircle,
  Smartphone,
  Sparkles,
  Tablet,
  PlayCircle,
} from "lucide-react";
import { AiAvatar } from "@/components/learn/AiAvatar";

const FORMATS = ["Video", "Notes", "Files", "Quizzes"];

const FLOW = [
  { tag: "Learn", label: "Watch the lesson" },
  { tag: "Practice", label: "Ask the AI tutor" },
  { tag: "Prove", label: "Earn your certificate" },
];

const TRACK = [
  { icon: CheckCircle2, label: "Lesson completed" },
  { icon: MessageCircle, label: "WhatsApp reminder sent" },
  { icon: Sparkles, label: "AI tutor answered" },
  { icon: BellRing, label: "Weekly goal on track" },
  { icon: Award, label: "Badge earned" },
];

const DEVICES = [
  { icon: Smartphone, label: "Phone" },
  { icon: Laptop, label: "Laptop" },
  { icon: Tablet, label: "Tablet" },
];

// Tools that feed into Etivio; they slide along a belt and pass under the Etivio AI hub one by one.
const TOOLS = [
  { icon: MessageCircle, color: "#25d366" },
  { icon: CreditCard, color: "#3bb75e" },
  { icon: PlayCircle, color: "#ff4d4d" },
  { icon: Landmark, color: "#f5a524" },
  { icon: Mail, color: "#7ea3ff" },
  { icon: FileText, color: "#ff7a59" },
  { icon: CalendarDays, color: "#4f8bff" },
  { icon: BellRing, color: "#c084fc" },
];

const PERKS = [
  "Learn at your pace",
  "AI tutor on every lesson",
  "Verifiable certificates",
  "Pay in Naira",
  "WhatsApp reminders",
  "Lifetime access",
  "Works on any phone",
  "Quizzes and notes",
  "Downloadable files",
  "Badges and streaks",
  "Group buy discounts",
  "Reviewed by Etivio",
];

export function Capabilities() {
  return (
    <section className="et-h2-cap et-h2-guided is-dark">
      <div className="et-h2-cap-head">
        <span className="et-h2-cap-eyebrow">
          <i aria-hidden="true" /> Inside Etivio
        </span>
        <h2>
          Everything you need to learn a skill, stay consistent and prove it
          to the world.
        </h2>
      </div>

      <div className="et-h2-cap-grid">
        {/* 1. Every format */}
        <article className="et-h2-cap-card">
          <div className="et-h2-cap-art" aria-hidden="true">
            <div className="et-h2-cap-stack">
              {FORMATS.map((f, i) => (
                <span key={f} style={{ "--i": i } as React.CSSProperties}>
                  {f}
                </span>
              ))}
            </div>
            <span className="et-h2-cap-wire" />
            <span className="et-h2-cap-node">Your course</span>
            <span className="et-h2-cap-wire" />
            <span className="et-h2-cap-tile">Learner</span>
          </div>
          <h3>Every format, one place</h3>
          <p>
            Video lessons, notes, downloadable files and quizzes live together
            in one course, so you never hunt across apps to keep learning.
          </p>
        </article>

        {/* 2. Step by step */}
        <article className="et-h2-cap-card">
          <div className="et-h2-cap-art is-col" aria-hidden="true">
            {FLOW.map((s, i) => (
              <div key={s.tag} className="et-h2-cap-flow">
                {i > 0 && <span className="et-h2-cap-vwire" />}
                <div
                  className="et-h2-cap-box"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <small>{s.tag}</small>
                  {s.label}
                </div>
              </div>
            ))}
            <span className="et-h2-cap-ready">
              <i /> Ready to share
            </span>
          </div>
          <h3>Learn, practice, prove</h3>
          <p>
            Short lessons, an AI tutor that knows the material and a
            verifiable certificate at the end. A clear path from day one to
            done.
          </p>
        </article>

        {/* 3. Stay on track */}
        <article className="et-h2-cap-card">
          <div className="et-h2-cap-art is-col" aria-hidden="true">
            <div className="et-h2-cap-input">
              <span>Finish 3 lessons this week</span>
            </div>
            <ul className="et-h2-cap-list">
              {TRACK.map(({ icon: Icon, label }, i) => (
                <li key={label} style={{ "--i": i } as React.CSSProperties}>
                  <span>
                    <Icon size={15} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <h3>Progress that keeps going</h3>
          <p>
            Set a weekly goal and Etivio does the nudging. Reminders, badges
            and streaks keep you moving when life gets busy.
          </p>
        </article>
      </div>

      <div className="et-h2-cap-grid is-two">
        {/* 4. Any device */}
        <article className="et-h2-cap-card">
          <div className="et-h2-cap-art is-col" aria-hidden="true">
            <span className="et-h2-cap-node">Your progress</span>
            <span className="et-h2-cap-vwire" />
            <div className="et-h2-cap-branch">
              {DEVICES.map(({ icon: Icon, label }, i) => (
                <span
                  key={label}
                  className="et-h2-cap-dev"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <Icon size={18} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <h3>Pick up where you stopped</h3>
          <p>
            Start a lesson on your phone, finish it on your laptop. Your
            progress, notes and certificates follow you on every device.
          </p>
        </article>

        {/* 5. Connected */}
        <article className="et-h2-cap-card">
          <div className="et-h2-cap-art" aria-hidden="true">
            <div className="et-h2-cap-flow-row">
              <div className="et-h2-cap-belt">
                {[...TOOLS, ...TOOLS, ...TOOLS].map(({ icon: Icon, color }, i) => (
                  <span key={i} style={{ color }}>
                    <Icon size={24} />
                  </span>
                ))}
              </div>
              <span className="et-h2-cap-hub">
                <AiAvatar size={58} />
              </span>
            </div>
          </div>
          <h3>Works with what you use</h3>
          <p>
            Pay with card or bank transfer through Paystack, get reminders on
            WhatsApp and email, and learn from video, PDFs and more in one
            place.
          </p>
        </article>
      </div>

      <div className="et-h2-cap-marquee" aria-hidden="true">
        {[0, 1].map((row) => (
          <div key={row} className={`et-h2-cap-track${row ? " is-rev" : ""}`}>
            {[...PERKS, ...PERKS].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
