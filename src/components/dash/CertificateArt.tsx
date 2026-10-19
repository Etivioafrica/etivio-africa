import type { Certificate } from "@/lib/data/certificates";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// The certificate itself. Every size is in container units (cqw), so the same markup renders as a
// thumbnail in the Certificates tab, full size on the public page, and one A4 page when printed.
export function CertificateArt({ cert, site }: { cert: Certificate; site: string }) {
  const ring = `cx-ring-${cert.code}`;
  return (
    <div className="et-cx" role="img" aria-label={`Etivio certificate: ${cert.recipientName} completed ${cert.courseTitle}, ${fmt(cert.issuedAt)}, ID ${cert.code}`}>
      <div className="et-cx-paper">
        <div className="et-cx-band">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/etiviologo.svg" alt="" className="et-cx-logo" />
          <span className="et-cx-band-tag">Certificate of completion</span>
        </div>

        <svg className="et-cx-seal" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <path id={ring} d="M 60,60 m -43,0 a 43,43 0 1,1 86,0 a 43,43 0 1,1 -86,0" />
          </defs>
          <circle cx="60" cy="60" r="58" fill="#ffffff" />
          <circle cx="60" cy="60" r="54" fill="none" stroke="#7c3aed" strokeWidth="2.2" />
          <circle cx="60" cy="60" r="31" fill="none" stroke="#7c3aed" strokeWidth="1.2" />
          {/* textLength stretches the phrase to exactly one lap of the ring (2π × 43 ≈ 270). */}
          <text fill="#6d28d9" fontSize="10" fontWeight="800">
            <textPath href={`#${ring}`} startOffset="0" textLength="268" lengthAdjust="spacing">
              ETIVIO AFRICA · CERTIFIED ·
            </textPath>
          </text>
          <image href="/etivio-mark.svg" x="44" y="44" width="32" height="32" />
        </svg>

        <div className="et-cx-body">
          <div className="et-cx-field et-cx-name">
            <b>{cert.recipientName}</b>
            <span>Learner</span>
          </div>

          <p className="et-cx-lead">has successfully completed</p>
          <h3 className="et-cx-course">{cert.courseTitle}</h3>

          <div className="et-cx-row">
            <div className="et-cx-field">
              <b>{fmt(cert.issuedAt)}</b>
              <span>Date</span>
            </div>
            <div className="et-cx-field">
              <b>{cert.code}</b>
              <span>Certificate ID</span>
            </div>
          </div>

          <div className="et-cx-field et-cx-sign">
            <i>{cert.instructorName ?? "Etivio Learning"}</i>
            <b>{cert.instructorName ?? "The Etivio team"}</b>
            <span>{cert.instructorName ? "Course tutor" : "Etivio Africa"}</span>
          </div>
        </div>

        <p className="et-cx-verify">Verify at {site.replace(/^https?:\/\//, "")}/certificate/{cert.code}</p>
      </div>
    </div>
  );
}
