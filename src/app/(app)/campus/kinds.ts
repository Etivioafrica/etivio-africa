// Shared by the server page and the browser: how each Campus post type looks.
import { BarChart3, Briefcase, HelpCircle, Megaphone, Trophy, type LucideIcon } from "lucide-react";
import type { CampusKind } from "@/lib/data/campus";

export const KIND_STYLE: Record<CampusKind, { label: string; icon: LucideIcon; className: string }> = {
  update: { label: "Update", icon: Megaphone, className: "is-update" },
  question: { label: "Question", icon: HelpCircle, className: "is-question" },
  win: { label: "Win", icon: Trophy, className: "is-win" },
  poll: { label: "Poll", icon: BarChart3, className: "is-poll" },
  opportunity: { label: "Opportunity", icon: Briefcase, className: "is-opportunity" },
};
