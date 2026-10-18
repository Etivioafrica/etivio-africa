import { AuthFrame } from "@/app/(auth)/AuthFrame";
import "@/app/(auth)/auth.css";

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthFrame title="Run Etivio from one place." body="Users, courses, content, support, and money. Staff access only." badge="Admin access only">
      {children}
    </AuthFrame>
  );
}
