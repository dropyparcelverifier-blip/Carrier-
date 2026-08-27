import type { MetadataRoute } from "next";
import { SITE_URL as SITE_URL_CONST } from "@/lib/company";

// Single source of truth — see lib/company.ts
const BASE_URL = SITE_URL_CONST;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /admin is behind a login and carries no content worth indexing;
      // /api/* is server-only data endpoints, never a page. Both were
      // previously crawlable/indexable by default with nothing telling
      // search engines otherwise.
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
