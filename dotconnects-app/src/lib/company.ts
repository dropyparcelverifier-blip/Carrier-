export type Claim = {
  label: string;
  verified: boolean;
};

export type SocialLink = {
  label: string;
  href: string;
};

/** The marketing site. Every link out of this app points there. */
export const SITE_URL = "https://dotconnectslogistics.com";

export const COMPANY = {
  legalName: "DotConnects Logistics",
  foundedYear: 2024,

  /** Kept in step with carrier/lib/company.ts by hand — two apps, one
   *  domain. If this ever disagrees with the marketing site, that one is
   *  authoritative. */
  domain: "dotconnectslogistics.com",
  /** The one contact this app shows. No phone line and no WhatsApp —
   *  nobody is staffed to answer either, and Dropy's own number (which
   *  sat here unused) doesn't belong on a DotConnects page. */
  email: "contact-us@dotconnectslogistics.com",

  credentials: [
    { label: "Licensed importer", verified: true },
    { label: "GST registered", verified: true },
    { label: "Customs broker", verified: false },
  ] satisfies Claim[],

  social: [
    { label: "Instagram", href: "https://instagram.com/dotconnectslogistics" },
    { label: "X", href: "https://x.com/dotconnectslogistics" },
    { label: "Facebook", href: "https://facebook.com/dotconnectslogistics" },
  ] satisfies SocialLink[],
} as const;
