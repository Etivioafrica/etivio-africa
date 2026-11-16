import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/email/site";

// Private areas no crawler should visit.
const PRIVATE = ["/admin", "/learn", "/teach", "/settings", "/profile", "/support", "/api", "/checkout", "/cart", "/verify", "/auth", "/set-password", "/reset-password", "/offline", "/suspended"];

// Crawlers that bring no visitors but every page they fetch runs our functions: AI training scrapers and SEO
// tool bots. Google, Bing and the AI search assistants (which link back to us) stay allowed.
const BLOCKED = [
  "GPTBot", "ChatGPT-User", "CCBot", "ClaudeBot", "anthropic-ai", "Claude-Web", "Google-Extended", "Applebot-Extended",
  "Bytespider", "meta-externalagent", "meta-externalfetcher", "FacebookBot", "Amazonbot", "cohere-ai", "Diffbot",
  "ImagesiftBot", "Omgilibot", "Timpibot", "AI2Bot", "PetalBot",
  "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "BLEXBot", "DataForSeoBot", "serpstatbot", "Barkrowler", "SeekportBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BLOCKED, disallow: "/" },
      // Search engines still index every public page, but not the endless filter/search combinations on /explore
      // (each one is a fresh server render; /explore itself is the canonical page).
      { userAgent: "*", allow: "/", disallow: [...PRIVATE, "/explore?"] },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
