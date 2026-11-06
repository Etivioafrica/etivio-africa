import { DesktopOnly } from "@/components/dash/DesktopOnly";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopOnly what="Building a course" backHref="/teach/courses" backLabel="Back to my courses">
      {children}
    </DesktopOnly>
  );
}
