import Link from "next/link";
import {
  BarChart3,
  Boxes,
  Brain,
  Briefcase,
  Camera,
  Code2,
  FlaskConical,
  Languages,
  Megaphone,
  Palette,
  PenLine,
  Sigma,
  Sprout,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// An endless strip under the dashboard panel (AgentLab's logo strip) listing what you can learn. Each one opens Explore
// searching that topic, so it works even before a course carries the exact label. Add or reorder topics here.
const TOPICS: { label: string; q: string; icon: LucideIcon }[] = [
  { label: "Artificial Intelligence", q: "AI", icon: Brain },
  { label: "Mathematics", q: "mathematics", icon: Sigma },
  { label: "Business", q: "business", icon: Briefcase },
  { label: "Software Development", q: "development", icon: Code2 },
  { label: "Data & Analytics", q: "data", icon: BarChart3 },
  { label: "Design", q: "design", icon: Palette },
  { label: "Marketing", q: "marketing", icon: Megaphone },
  { label: "Finance", q: "finance", icon: Wallet },
  { label: "Writing", q: "writing", icon: PenLine },
  { label: "Sales", q: "sales", icon: TrendingUp },
  { label: "Science", q: "science", icon: FlaskConical },
  { label: "Languages", q: "language", icon: Languages },
  { label: "Photography & Video", q: "video", icon: Camera },
  { label: "Personal Growth", q: "personal growth", icon: Sprout },
  { label: "Product", q: "product", icon: Boxes },
];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined}>
      {TOPICS.map(({ label, q, icon: Icon }) => (
        <li key={label}>
          <Link href={`/explore?q=${encodeURIComponent(q)}`} tabIndex={hidden ? -1 : undefined}>
            <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Ticker() {
  return (
    <nav className="et-x-ticker" aria-label="Browse by topic">
      <div className="et-x-ticker-view">
        <div className="et-x-ticker-track">
          <Row />
          <Row hidden />
        </div>
      </div>
      <b className="h bl" />
      <b className="h br" />
    </nav>
  );
}
