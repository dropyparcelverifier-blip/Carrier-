export type Claim = {
  label: string;
  verified: boolean;
};

export type SocialLink = {
  label: string;
  href: string;
};

export const COMPANY = {
  legalName: "DotConnects Logistics",
  foundedYear: 2024,

  email: "support@dotconnectslogistics.in",
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
