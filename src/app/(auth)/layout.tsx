import { Bebas_Neue } from "next/font/google";
import { AuthFrame } from "./AuthFrame";
import "./auth.css";

// Tall condensed type for the phone sign-in and sign-up headline.
const display = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-auth-display" });

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={display.variable}>
      <AuthFrame>{children}</AuthFrame>
    </div>
  );
}
