import { Award, Banknote, Globe, MessagesSquare, PlayCircle, Sparkles, type LucideIcon } from "lucide-react";

// A slow, endless strip under the dashboard panel (AgentLab's logo strip). It only says things that are true of Etivio
// today: swap or add items here, or put real partner logos in public/home/logos and list them instead.
const ITEMS: { label: string; icon?: LucideIcon; word?: boolean }[] = [
  { label: "paystack", word: true },
  { label: "Verified certificates", icon: Award },
  { label: "Pay in naira", icon: Banknote },
  { label: "Video lessons", icon: PlayCircle },
  { label: "Etivio AI study partner", icon: Sparkles },
  { label: "Campus community", icon: MessagesSquare },
  { label: "Built for Africa", icon: Globe },
];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined}>
      {ITEMS.map(({ label, icon: Icon, word }) => (
        <li key={label} className={word ? "is-word" : ""}>
          {Icon && <Icon size={22} strokeWidth={1.9} aria-hidden="true" />}
          {label}
        </li>
      ))}
    </ul>
  );
}

export function Ticker() {
  return (
    <div className="et-x-ticker" role="region" aria-label="What Etivio offers">
      <div className="et-x-ticker-view">
        <div className="et-x-ticker-track">
          <Row />
          <Row hidden />
        </div>
      </div>
      <b className="h bl" />
      <b className="h br" />
    </div>
  );
}
