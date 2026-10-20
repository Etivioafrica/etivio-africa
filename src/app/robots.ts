import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/email/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/learn", "/teach", "/settings", "/profile", "/support", "/api", "/checkout", "/verify"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
