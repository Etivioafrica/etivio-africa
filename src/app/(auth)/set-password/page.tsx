import { Suspense } from "react";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata = { title: "Choose your password | Etivio", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string }> };

export default function SetPasswordPage({ searchParams }: Props) {
  return (
    <Suspense fallback={null}>
      <Form searchParams={searchParams} />
    </Suspense>
  );
}

async function Form({ searchParams }: Props) {
  const { next } = await searchParams;
  return <SetPasswordForm next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/learn"} />;
}
