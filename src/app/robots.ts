import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /api/github/ stays crawlable on purpose: profile pages are rendered in the
// browser from that JSON, so a crawler that executes JS needs it to see the
// page (answers are cached, rate-limited per IP and sent with
// "X-Robots-Tag: noindex"). The rest of the API is of no use to crawlers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/github/"],
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
