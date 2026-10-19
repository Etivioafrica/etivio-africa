import { Suspense } from "react";
import Link from "next/link";
import { Award, ExternalLink, Lock } from "lucide-react";
import { CopyLink } from "@/components/dash/CopyLink";
import { EmptyMini, Progress } from "@/components/dash/ui";
import { LinkedInIcon } from "@/components/dash/ProfileView";
import { CertificateArt } from "@/components/dash/CertificateArt";
import { getCurrentUser } from "@/lib/auth";
import { getMyCertificates, linkedInAddUrl } from "@/lib/data/certificates";
import { getLearnerProfile } from "@/lib/data/profile";
import { getPlatformSettings } from "@/lib/platform";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Certificates" };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://etivio.co";

export default function CertificatesPage() {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 240 }} />}>
      <Certificates />
    </Suspense>
  );
}

async function Certificates() {
  const user = await getCurrentUser();
  const [certs, data, platform] = await Promise.all([getMyCertificates(user.id), getLearnerProfile(user.id), getPlatformSettings()]);
  const issued = new Set(certs.map((c) => c.courseId));
  // Courses still in progress get a locked preview of the certificate they'll earn.
  const locked = (data?.courses ?? []).filter((c) => !c.completed && !issued.has(c.id));

  if (!certs.length && !locked.length)
    return (
      <section className="et-card">
        <EmptyMini icon={Award} title="No certificates yet" action={{ href: "/learn/browse", label: "Browse courses" }}>
          Enroll in a course and finish every lesson. Your certificate is issued automatically.
        </EmptyMini>
      </section>
    );

  return (
    <>
      {certs.length > 0 && (
        <div className="et-cert-grid">
          {certs.map((c) => (
            <article key={c.code} className="et-card et-cert-card">
              <Link href={`/certificate/${c.code}`} className="et-cert-thumb" aria-label={`View certificate for ${c.courseTitle}`}>
                <CertificateArt cert={c} site={SITE} signer={platform.certificateSigner} />
              </Link>
              <div className="et-cert-card-body">
                <h3>{c.courseTitle}</h3>
                <small>
                  Issued {formatDate(c.issuedAt)} · ID {c.code}
                </small>
                <div className="et-inline">
                  <Link href={`/certificate/${c.code}`} className="et-btn et-btn-primary et-btn-sm">
                    <ExternalLink size={14} /> View
                  </Link>
                  <a href={linkedInAddUrl(c, SITE)} target="_blank" rel="noopener noreferrer" className="et-btn et-btn-ghost et-btn-sm">
                    <LinkedInIcon /> Add to LinkedIn
                  </a>
                  <CopyLink path={`/certificate/${c.code}`} label="Copy link" />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {locked.length > 0 && (
        <>
          <p className="et-section-label">Finish to unlock</p>
          <div className="et-cert-grid">
            {locked.map((c) => {
              const left = Math.max(0, c.total - c.done);
              return (
                <article key={c.id} className="et-card et-cert-card is-locked">
                  <div className="et-cert-thumb">
                    <CertificateArt
                      site={SITE}
                      signer={platform.certificateSigner}
                      cert={{ code: "••••••••", courseId: c.id, recipientName: data!.profile.name, courseTitle: c.title, instructorName: c.instructor, issuedAt: new Date().toISOString() }}
                    />
                    <div className="et-cert-lock">
                      <span>
                        <Lock size={18} />
                      </span>
                      <b>Locked</b>
                    </div>
                  </div>
                  <div className="et-cert-card-body">
                    <h3>{c.title}</h3>
                    <Progress value={c.progress} label={`${c.done}/${c.total}`} />
                    <small>
                      {c.total ? `${left} lesson${left === 1 ? "" : "s"} left to earn this certificate` : "Lessons are on the way"}
                    </small>
                    <div className="et-inline">
                      <Link href={`/learn/course/${c.id}`} className="et-btn et-btn-primary et-btn-sm">
                        {c.done ? "Continue course" : "Start course"}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
