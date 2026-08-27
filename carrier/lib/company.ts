export type Claim = {
  label: string;
  verified: boolean;
};

export type SocialLink = {
  label: string;
  href: string;
};

/**
 * ONE place for the domain.
 *
 * It was hardcoded in eight files across both apps — layout.tsx,
 * robots.ts, sitemap.ts, OrganizationJsonLd.tsx, tracking-site.ts,
 * .env.example and both company.ts files — in three different spellings.
 * Everything derives from this constant now, so changing it is one edit
 * rather than eight and a search.
 *
 * dotconnectlogistics.com (no "s" after connect) is the defensive
 * registration for the typo people will make. It should 301 here rather
 * than serve anything.
 */
export const DOMAIN = "dotconnectslogistics.com";
export const SITE_URL = `https://${DOMAIN}`;
export const TRACKING_URL = `https://track.${DOMAIN}`;

export const COMPANY = {
  legalName: "DotConnects Logistics",
  foundedYear: 2024,
  domain: DOMAIN,
  siteUrl: SITE_URL,

  /** General enquiries — the address a prospect writes to. */
  email: `queries@${DOMAIN}`,
  /** Existing shipments and support. */
  supportEmail: `support@${DOMAIN}`,
  phone: "+91 22 4000 1188",
  phoneHref: "tel:+912240001188",
  locations: "Origin gateways worldwide · India destination network",

  // "Customs broker" was listed with verified: false — an unverified
  // credential on a page whose whole job is to be trusted. Removed rather
  // than caveated. Everything left is true without a footnote.
  credentials: [
    { label: "Licensed importer", verified: true },
    { label: "GST registered", verified: true },
  ] satisfies Claim[],

  social: [
    { label: "Instagram", href: "https://instagram.com/dotconnectslogistics" },
    { label: "X", href: "https://x.com/dotconnectslogistics" },
    { label: "Facebook", href: "https://facebook.com/dotconnectslogistics" },
  ] satisfies SocialLink[],
} as const;
