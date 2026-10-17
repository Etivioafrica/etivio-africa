import { AuthFrame } from "./AuthFrame";
import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
