import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";

// Admin-set message (Admin > Settings > Appearance) shown above the dashboard banner.
export function AnnouncementBar({ text, link }: { text: string; link: string | null }) {
  const body = (
    <>
      <span className="et-announce-icon">
        <Megaphone size={15} />
      </span>
      <span className="et-announce-text">{text}</span>
      {link && <ArrowRight size={15} className="et-announce-arrow" />}
    </>
  );
  if (!link) return <div className="et-announce">{body}</div>;
  return link.startsWith("/") ? (
    <Link href={link} className="et-announce is-link">
      {body}
    </Link>
  ) : (
    <a href={link} target="_blank" rel="noopener noreferrer" className="et-announce is-link">
      {body}
    </a>
  );
}
