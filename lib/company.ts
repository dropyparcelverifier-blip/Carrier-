export type Claim = {
  label: string;
  verified: boolean;
};

export const COMPANY = {
  legalName: "Dropy",
  foundedYear: 2024,

  email: "support@dropy.in",
  phone: "+91 22 4000 1188",
  phoneHref: "tel:+912240001188",
  locations: "Newark, NJ · Vashi, Navi Mumbai",

  credentials: [
    { label: "Licensed importer", verified: true },
    { label: "GST registered", verified: true },
    { label: "Customs broker", verified: false },
  ] satisfies Claim[],
} as const;
