import type { MetadataRoute } from "next";
import { SITE_URL as SITE_URL_CONST } from "@/lib/company";

// Single source of truth — see lib/company.ts
const BASE_URL = SITE_URL_CONST;

/**
 * Public, indexable pages only — /admin and every app/api/* route are
 * deliberately excluded (also blocked in app/robots.ts). /track and
 * /quote are listed at their base path, not per-query-string variant,
 * since a specific tracking ID or quote selection isn't a distinct
 * crawlable page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
    { path: "", changeFrequency: "weekly", priority: 1.0 },
    { path: "/about", changeFrequency: "monthly", priority: 0.8 },
    { path: "/quote", changeFrequency: "monthly", priority: 0.9 },
    { path: "/track", changeFrequency: "monthly", priority: 0.9 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
    { path: "/cargo-claims", changeFrequency: "yearly", priority: 0.3 },
    { path: "/prohibited-items", changeFrequency: "yearly", priority: 0.3 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
    { path: "/cookies", changeFrequency: "yearly", priority: 0.2 },
  ];

  return routes.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
