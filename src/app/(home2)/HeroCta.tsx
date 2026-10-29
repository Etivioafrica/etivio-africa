"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import SpecularButton from "@/components/fx/SpecularButton";

// The hero's main button: a solid ink SpecularButton whose lit edge follows the cursor. It is a <button>, so it
// navigates on click and prefetches sign up so the move is instant.
export function HeroCta() {
  const router = useRouter();
  useEffect(() => router.prefetch("/signup"), [router]);
  return (
    <SpecularButton
      size="lg"
      radius={12}
      tint="#0b1020"
      tintOpacity={1}
      textColor="#ffffff"
      lineColor="#ffffff"
      baseColor="#0b1020"
      intensity={1}
      idleIntensity={0.45}
      shineSize={12}
      shineFade={40}
      thickness={1.4}
      glow={1}
      followMouse
      proximity={260}
      className="et-h2-cta"
      onClick={() => router.push("/signup")}
    >
      Start learning <ArrowRight size={18} aria-hidden="true" />
    </SpecularButton>
  );
}
