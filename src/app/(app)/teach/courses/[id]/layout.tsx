import { DesktopOnly } from "@/components/dash/DesktopOnly";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopOnly what="Editing a course" backHref="/teach/courses" backLabel="Back to my courses">
      {children}
    </DesktopOnly>
  );
}
