import { Suspense } from "react";
import type { Metadata } from "next";
import { BadgeCelebration } from "@/components/dash/BadgeCelebration";
import { ThemeScope } from "@/components/learn/PlayerFrame";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import "../(app)/app.css";

export const metadata: Metadata = {
  title: { default: "Course", template: "%s | Etivio" },
  robots: { index: false, follow: false },
};

// The course player is full screen: no dashboard sidebar, just the course outline (see PlayerFrame).
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <Celebrations />
      </Suspense>
    </>
  );
}

// Badges earned by finishing a lesson pop up here, as they do in the dashboard shell.
async function Celebrations() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: unseen } = await supabase.from("user_badges").select("badge_id").eq("user_id", user.id).is("seen_at", null);
  return (
    <ThemeScope>
      <BadgeCelebration trigger={(unseen ?? []).map((b) => b.badge_id).join(",")} />
    </ThemeScope>
  );
}
