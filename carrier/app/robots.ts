import type { MetadataRoute } from "next";

const BASE_URL = "https://dotconnectslogistics.in";

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
