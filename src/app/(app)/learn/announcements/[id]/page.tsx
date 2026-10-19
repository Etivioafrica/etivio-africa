import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRichText } from "@/lib/sanitize";
import { formatAnnouncementDate, getYoutubeEmbedUrl, liveDate, type Announcement } from "@/lib/announcements";

export const metadata = { title: "Announcement" };

type Props = { params: Promise<{ id: string }> };

export default function AnnouncementPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="et-skel" style={{ height: 320 }} />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, status, pinned, created_at, scheduled_at, cover_image_url, cover_video_url")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const a = data as Announcement;
  const embed = a.cover_video_url ? getYoutubeEmbedUrl(a.cover_video_url) : null;
  const hasCover = Boolean(embed || a.cover_image_url);

  const content = (
    <div className="et-ann-detail-text">
      {a.pinned && (
        <p className="et-ann-pinned-tag">
          <Pin size={12} fill="currentColor" /> Pinned
        </p>
      )}
      <h1>{a.title}</h1>
      <p className="et-muted" style={{ fontSize: 12.5 }}>
        {formatAnnouncementDate(liveDate(a), true)}
      </p>
      <hr />
      {/* Sanitised when saved and again here, so stored HTML can never run scripts. */}
      <div className="et-rich" dangerouslySetInnerHTML={{ __html: sanitizeRichText(a.body) }} />
    </div>
  );

  return (
    <div className="et-page">
      <Link href="/learn/announcements" className="et-back">
        <ArrowLeft size={14} /> All announcements
      </Link>
      {hasCover ? (
        <div className="et-ann-detail">
          <div className="et-ann-detail-media">
            {embed ? (
              <iframe src={embed} title={a.title} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.cover_image_url!} alt="" />
            )}
          </div>
          {content}
        </div>
      ) : (
        <div className="et-ann-detail-solo">{content}</div>
      )}
    </div>
  );
}
