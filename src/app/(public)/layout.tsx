import "../(app)/app.css";
import { PublicFrame } from "./PublicFrame";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicFrame>{children}</PublicFrame>;
}
