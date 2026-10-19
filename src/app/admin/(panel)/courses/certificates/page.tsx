import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { CertificatesClient } from "./CertificatesClient";

export const metadata = { title: "Certificates" };

export default function Certificates() {
  return (
    <div className="et-page">
      <Suspense fallback={<div className="et-skel" style={{ height: 420 }} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const { db } = await requireAdmin("courses");
  const { data } = await db
    .from("certificates")
    .select("code, user_id, course_id, recipient_name, course_title, instructor_name, issued_at, revoked_at, revoked_reason")
    .order("issued_at", { ascending: false })
    .limit(2000);
  return (
    <>
      <div className="et-page-head">
        <div>
          <h1>Certificates</h1>
          <p>Every certificate issued. Each one has a public verify page; revoking marks it as no longer valid there.</p>
        </div>
      </div>
      <CertificatesClient certs={data ?? []} />
    </>
  );
}
