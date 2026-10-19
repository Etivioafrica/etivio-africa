import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { VerifyBox } from "./VerifyBox";

export const metadata = {
  title: "Verify a certificate | Etivio",
  description: "Check that an Etivio certificate is genuine by entering its certificate ID.",
};

export default function VerifyCertificate({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 260 }} />}>
      <Verify searchParams={searchParams} />
    </Suspense>
  );
}

async function Verify({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = ((await searchParams).code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code) redirect(`/certificate/${code}`);

  return (
    <section className="et-card et-verify">
      <span className="et-cta-icon">
        <ShieldCheck size={24} />
      </span>
      <h1>Verify a certificate</h1>
      <p>Every Etivio certificate has a unique 8-character ID, printed at the bottom. Enter it to confirm it was issued by Etivio.</p>
      <VerifyBox />
    </section>
  );
}
