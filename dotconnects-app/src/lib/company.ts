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
  email: "support@dotconnectslogistics.com",
  queriesEmail: "queries@dotconnectslogistics.com",
  phone: "+91 22 4000 1188",
  phoneHref: "tel:+912240001188",
  whatsapp: "+91 98679 96311",
  whatsappHref: "https://wa.me/919867996311",
  locations: "Newark, NJ · Vashi, Navi Mumbai",

  credentials: [
    { label: "Licensed importer", verified: true },
    { label: "GST registered", verified: true },
    { label: "Customs broker", verified: false },
  ] satisfies Claim[],

  social: [
    { label: "WhatsApp", href: "https://wa.me/919867996311" },
    { label: "Instagram", href: "https://instagram.com/dotconnectslogistics" },
    { label: "X", href: "https://x.com/dotconnectslogistics" },
    { label: "Facebook", href: "https://facebook.com/dotconnectslogistics" },
  ] satisfies SocialLink[],
} as const;
