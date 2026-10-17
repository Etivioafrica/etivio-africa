import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata = { title: "Admin sign in | Etivio", robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AdminLoginForm />}>
      <AlreadySignedIn />
    </Suspense>
  );
}

// Admins who are already signed in skip the form.
async function AlreadySignedIn() {
  if (await getAdminUser()) redirect("/admin");
  return <AdminLoginForm />;
}
