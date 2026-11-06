import { DesktopOnly } from "@/components/dash/DesktopOnly";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopOnly what="Editing a product" backHref="/teach/products" backLabel="Back to my products">
      {children}
    </DesktopOnly>
  );
}
