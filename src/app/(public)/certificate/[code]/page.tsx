import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ShieldX } from "lucide-react";
import { LinkedInIcon } from "@/components/dash/ProfileView";
import { CopyLink } from "@/components/dash/CopyLink";
import { createClient } from "@/lib/supabase/server";
import { getCertificate, linkedInAddUrl } from "@/lib/data/certificates";
import { PrintButton } from "./PrintButton";
import { VerifyBox } from "../VerifyBox";
import { CertificateArt } from "@/components/dash/CertificateArt";
import { getPlatformSettings } from "@/lib/platform";

type Props = { params: Promise<{ code: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://etivio.co";
const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cert = await getCertificate((await params).code.toUpperCase());
  if (!cert) return { title: "Certificate not found | Etivio", robots: { index: false } };
  const title = `${cert.recipientName} completed ${cert.courseTitle} | Etivio`;
  return { title, description: `Certificate ${cert.code}, issued ${fmt(cert.issuedAt)} by Etivio.`, robots: { index: false } };
}

export default function CertificatePage({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 520 }} />}>
      <CertificateContent params={params} />
    </Suspense>
  );
}

async function CertificateContent({ params }: Props) {
  const code = (await params).code.toUpperCase();
  const cert = await getCertificate(code);
  if (!cert)
    return (
      <section className="et-card et-verify is-bad">
        <span className="et-cta-icon">
          <ShieldX size={24} />
        </span>
        <h1>Certificate not found</h1>
        <p>
          No Etivio certificate has the ID <b>{code.slice(0, 12)}</b>. Check the ID for typos. Certificate IDs never contain the letters O or I, or the
          numbers 0 or 1.
        </p>
        <VerifyBox defaultCode={code.slice(0, 12)} />
      </section>
    );

  if (cert.revokedAt)
    return (
      <section className="et-card et-verify is-bad">
        <span className="et-cta-icon">
          <ShieldX size={24} />
        </span>
        <h1>This certificate has been revoked</h1>
        <p>
          Certificate <b>{cert.code}</b> was issued to {cert.recipientName} for {cert.courseTitle} on {fmt(cert.issuedAt)}, but Etivio revoked it on{" "}
          {fmt(cert.revokedAt)}. It is no longer valid.
        </p>
        {cert.revokedReason && (
          <p>
            <b>Reason:</b> {cert.revokedReason}
          </p>
        )}
        <VerifyBox />
      </section>
    );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: mine } = user ? await supabase.from("certificates").select("code").eq("code", cert.code).maybeSingle() : { data: null };

  return (
    <>
      <div className="et-cert-bar">
        <p className="et-cert-verified">
          <BadgeCheck size={16} /> Verified: issued by Etivio to {cert.recipientName} on {fmt(cert.issuedAt)}
        </p>
        <div className="et-inline">
          <CopyLink path={`/certificate/${cert.code}`} label="Copy link" />
          {mine && (
            <a href={linkedInAddUrl(cert, SITE)} target="_blank" rel="noopener noreferrer" className="et-btn et-btn-ghost">
              <LinkedInIcon /> Add to LinkedIn
            </a>
          )}
          <PrintButton />
        </div>
      </div>

      <article className="et-cert-frame">
        <CertificateArt cert={cert} site={SITE} signer={(await getPlatformSettings()).certificateSigner} />
      </article>

      {cert.username && (
        <p className="et-cert-owner">
          <Link href={`/@${cert.username}`}>See {cert.recipientName.split(" ")[0]}&apos;s profile</Link>
        </p>
      )}
    </>
  );
}
