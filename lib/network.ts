/**
 * The physical network: where cargo is onboarded, who flies or sails it, and
 * what happens to it after it lands.
 *
 * Carrier names and logos below are the actual operators used on each leg.
 *
 * The logo files are REFERENCE ONLY — see the `logo` field note. Naming a
 * carrier is ordinary commercial fact; reproducing their mark is not, and
 * needs their permission before this site is public.
 *
 * Transit windows and cut-offs are PLACEHOLDER. Replace with your own booking
 * data before this goes in front of a customer.
 */

export type Origin = {
  country: string;
  flag: string;
  hubs: string;
  /** What tends to come out of this market. */
  focus: string;
  transit: string;
  /** [lon, lat] of the primary departure gateway. */
  coord: [number, number];
  gateway: string;
  gatewayName: string;
  /**
   * National flag under /public/flags, from Wikimedia Commons.
   *
   * Unlike the carrier logos these carry no trademark question — national
   * flags are public domain. Drawn as files rather than emoji because Windows
   * has no glyphs for regional-indicator pairs and renders them as bare
   * letters, which is exactly what the code beside it already says.
   */
  flagSrc: string;
};

/** Onboarding markets. Goods are consolidated at the gateway before uplift. */
export const ORIGINS: Origin[] = [
  {
    country: "United States",
    flag: "US",
    hubs: "Newark · New York · Chicago · Los Angeles",
    focus: "Colour cosmetics, skincare, supplements and salon haircare",
    transit: "5–8 days by air",
    coord: [-74.17, 40.69],
    flagSrc: "/flags/us.svg",
    gateway: "EWR",
    gatewayName: "Newark",
  },
  {
    country: "United Kingdom",
    flag: "UK",
    hubs: "London Heathrow",
    focus: "Fragrance, premium skincare and pharmacy-brand personal care",
    transit: "4–6 days by air",
    coord: [-0.46, 51.47],
    flagSrc: "/flags/gb.svg",
    gateway: "LHR",
    gatewayName: "London",
  },
  {
    country: "South Korea",
    flag: "KR",
    hubs: "Seoul Incheon",
    focus: "K-beauty skincare, sheet masks, sun care and colour",
    transit: "4–6 days by air",
    coord: [126.45, 37.46],
    flagSrc: "/flags/kr.svg",
    gateway: "ICN",
    gatewayName: "Seoul",
  },
  {
    country: "Japan",
    flag: "JP",
    hubs: "Tokyo Narita",
    focus: "J-beauty skincare, sun care and premium haircare",
    transit: "5–7 days by air",
    coord: [140.39, 35.76],
    flagSrc: "/flags/jp.svg",
    gateway: "NRT",
    gatewayName: "Tokyo",
  },
  {
    country: "Australia",
    flag: "AU",
    hubs: "Sydney Kingsford Smith",
    focus: "Natural skincare, supplements and sun care",
    transit: "6–8 days by air",
    coord: [151.18, -33.94],
    flagSrc: "/flags/au.svg",
    gateway: "SYD",
    gatewayName: "Sydney",
  },
];

export type Carrier = {
  name: string;
  /** Which leg they handle. */
  leg: "International air" | "Ocean" | "India last mile";
  service: string;
  note: string;
  /** The operator's own brand colour, used for the chip tint. */
  brand: string;
  /** Initials, shown if the logo fails to load. */
  mark: string;
  /**
   * Logo file under /public/carriers, sourced from Wikimedia Commons.
   *
   * REFERENCE / DEMO ONLY. These are the operators' registered trademarks.
   * Displaying them does not make us an authorised partner, and this repo is
   * public — get written permission from each carrier before this goes live,
   * or revert to the `mark` initials, which the component still supports.
   */
  logo: string;
  /** Rough aspect, so the chip reserves a sensible box. */
  logoAspect: "wide" | "square" | "tall";
};

/**
 * Operators we book. Which one moves a given consignment depends on the lane,
 * the weight break and whether the cargo is classed as dangerous goods.
 */
export const CARRIERS: Carrier[] = [
  {
    name: "DHL Express",
    leg: "International air",
    service: "Express parcel & light freight",
    note: "Fastest door-to-door on small, high-value consignments.",
    brand: "#D40511",
    mark: "DHL",
    logo: "/carriers/dhl.svg",
    logoAspect: "wide",
  },
  {
    name: "FedEx",
    leg: "International air",
    service: "International Priority",
    note: "Used where a US supplier already ships on their own account.",
    brand: "#4D148C",
    mark: "FDX",
    logo: "/carriers/fedex.svg",
    logoAspect: "wide",
  },
  {
    name: "UPS",
    leg: "International air",
    service: "Worldwide Express",
    note: "Strong on the UK lane and on temperature-controlled boxes.",
    brand: "#5A3A22",
    mark: "UPS",
    logo: "/carriers/ups.svg",
    logoAspect: "tall",
  },
  {
    name: "Emirates SkyCargo",
    leg: "International air",
    service: "General & dangerous-goods air freight",
    note: "Main uplift for palletised cosmetics via Dubai.",
    brand: "#D71921",
    mark: "EK",
    logo: "/carriers/emirates.svg",
    logoAspect: "square",
  },
  {
    name: "Korean Air Cargo",
    leg: "International air",
    service: "General air freight",
    note: "Direct Incheon to Mumbai for K-beauty volume.",
    brand: "#0F4C97",
    mark: "KE",
    logo: "/carriers/koreanair.svg",
    logoAspect: "wide",
  },
  {
    name: "ANA Cargo",
    leg: "International air",
    service: "General air freight",
    note: "Narita to Mumbai for J-beauty consignments.",
    brand: "#13448F",
    mark: "NH",
    logo: "/carriers/ana.svg",
    logoAspect: "wide",
  },
  {
    name: "Qantas Freight",
    leg: "International air",
    service: "General air freight",
    note: "Sydney uplift, usually via Singapore.",
    brand: "#E40000",
    mark: "QF",
    logo: "/carriers/qantas.svg",
    logoAspect: "wide",
  },
  {
    name: "Maersk",
    leg: "Ocean",
    service: "FCL & LCL",
    note: "Weekly sailings into Nhava Sheva and Mundra.",
    brand: "#1B6EA8",
    mark: "MSK",
    logo: "/carriers/maersk.svg",
    logoAspect: "wide",
  },
  {
    name: "CMA CGM",
    leg: "Ocean",
    service: "FCL",
    note: "Alternate ocean routing when space is tight.",
    brand: "#0F4C9B",
    mark: "CMA",
    logo: "/carriers/cmacgm.svg",
    logoAspect: "square",
  },
  {
    name: "Blue Dart",
    leg: "India last mile",
    service: "Domestic express",
    note: "Same-day and next-day across Mumbai and Navi Mumbai.",
    brand: "#003F87",
    mark: "BD",
    logo: "/carriers/bluedart.svg",
    logoAspect: "wide",
  },
  {
    name: "DTDC",
    leg: "India last mile",
    service: "Surface & express",
    note: "Cost-effective for bulk cartons to distributor warehouses.",
    brand: "#C4161C",
    mark: "DTC",
    logo: "/carriers/dtdc.png",
    logoAspect: "wide",
  },
  {
    name: "Delhivery",
    leg: "India last mile",
    service: "Surface freight",
    note: "Used for palletised moves out of the Vashi facility.",
    brand: "#B8001F",
    mark: "DEL",
    logo: "/carriers/delhivery.png",
    logoAspect: "wide",
  },
];

export type ClearanceStep = {
  step: string;
  title: string;
  where: string;
  body: string;
  checks: string[];
};

/**
 * What happens between the aircraft landing and the cargo reaching Vashi.
 *
 * The two verifications at Mumbai air cargo are distinct and sequential: a
 * documentary assessment first, then a physical examination. Cargo does not
 * move to the bonded facility until both are cleared.
 */
export const CLEARANCE: ClearanceStep[] = [
  {
    step: "01",
    title: "Documentary verification",
    where: "Sahar Air Cargo Complex, Mumbai (BOM)",
    body: "Bill of entry filed against the manifest before the aircraft lands, so assessment starts on arrival rather than after it. Customs check the paperwork agrees with itself and with the regulator's records.",
    checks: [
      "Bill of entry matched to invoice, packing list and AWB",
      "CDSCO cosmetic import registration verified per SKU",
      "FSSAI clearance for any nutraceutical line",
      "Country of origin and HS classification assessed",
    ],
  },
  {
    step: "02",
    title: "Physical verification",
    where: "Examination bay, Sahar Air Cargo Complex",
    body: "Customs open a sample of cartons and check the goods against the declaration. This is where short-dated stock and label mismatches surface — which is why we screen both at origin.",
    checks: [
      "Carton count and gross weight against the declaration",
      "Batch and expiry read from the packs, residual shelf life confirmed",
      "Label claims checked against the registered artwork",
      "Duty assessed, paid, out-of-charge issued",
    ],
  },
];

export type Facility = {
  name: string;
  location: string;
  role: string;
  detail: string;
};

export const FACILITIES: Facility[] = [
  {
    name: "Bonded warehouse",
    location: "Vashi, Navi Mumbai",
    role: "Hold, label, release",
    detail: "Duty-unpaid stock held until you call it off, sorted and released to your dock in batch order.",
  },
  {
    name: "Air cargo clearance",
    location: "Sahar Air Cargo Complex, Mumbai",
    role: "Customs",
    detail: "Both verifications happen here. Median clearance is under two days once the bill of entry is assessed.",
  },
  {
    name: "Sea cargo clearance",
    location: "JNPT Nhava Sheva",
    role: "Customs",
    detail: "Ocean consignments clear here instead, then move bonded to Vashi by road.",
  },
];

/**
 * The lanes the site shows as currently running.
 *
 * `progress` is where each lane actually reports its cargo — the map parks
 * the marker there and never past it. Shared between the hero backdrop, which
 * only borrows the geometry, and the coverage panel, which shows the status.
 *
 * PLACEHOLDER positions. Wire to live booking data before this goes in front
 * of a customer.
 */
export type Lane = {
  id: string;
  code: string;
  city: string;
  country: string;
  /** [lon, lat] */
  from: [number, number];
  mode: "air" | "ocean";
  carrier: string;
  /** 0-100 along the arc. */
  progress: number;
  status:
    | "In transit"
    | "Customs clearance"
    | "At bonded warehouse"
    | "Delivered"
    | "Booked";
};

export type DomesticHub = {
  city: string;
  /** [lon, lat] */
  coord: [number, number];
};

/**
 * Where cargo goes after Vashi — the last-mile network (Blue Dart, DTDC,
 * Delhivery, above) fans out from the bonded warehouse to these distribution
 * points, which is also where our marketplace/retailer clients (see
 * lib/clients.ts) actually sit. Shown on the network map as static spokes off
 * the Vashi hub, distinct from the animated inbound lanes.
 */
export const DOMESTIC_HUBS: DomesticHub[] = [
  { city: "Delhi", coord: [77.1, 28.61] },
  { city: "Bengaluru", coord: [77.59, 12.97] },
  { city: "Chennai", coord: [80.27, 13.08] },
];

export type WorldHub = {
  city: string;
  /** [lon, lat] */
  coord: [number, number];
};

/**
 * Major logistics-hub cities shown on the network map as static warehouse
 * markers, beyond the five active ORIGINS/LANES gateways. Illustrative only —
 * PLACEHOLDER, like the rest of this file — swap for real facility locations
 * before this goes in front of a customer.
 */
export const WORLD_HUBS: WorldHub[] = [
  { city: "Dubai", coord: [55.27, 25.2] },
  { city: "Singapore", coord: [103.82, 1.35] },
  { city: "Hong Kong", coord: [114.17, 22.28] },
  { city: "Frankfurt", coord: [8.68, 50.11] },
];

export const LANES: Lane[] = [
  {
    id: "us",
    code: "EWR",
    city: "Newark",
    country: "United States",
    from: [-74.17, 40.69],
    mode: "air",
    carrier: "Emirates SkyCargo",
    progress: 74,
    status: "In transit",
  },
  {
    id: "uk",
    code: "LHR",
    city: "London",
    country: "United Kingdom",
    from: [-0.46, 51.47],
    mode: "air",
    carrier: "UPS",
    progress: 100,
    status: "Customs clearance",
  },
  {
    id: "kr",
    code: "ICN",
    city: "Seoul",
    country: "South Korea",
    from: [126.45, 37.46],
    mode: "air",
    carrier: "Korean Air Cargo",
    progress: 68,
    status: "In transit",
  },
  {
    id: "jp",
    code: "NRT",
    city: "Tokyo",
    country: "Japan",
    from: [140.39, 35.76],
    mode: "air",
    carrier: "ANA Cargo",
    progress: 100,
    status: "At bonded warehouse",
  },
  {
    id: "au",
    code: "SYD",
    city: "Sydney",
    country: "Australia",
    from: [151.18, -33.94],
    mode: "air",
    carrier: "Qantas Freight",
    progress: 31,
    status: "In transit",
  },
  {
    id: "us-sea",
    code: "USNYC",
    city: "New York",
    country: "United States",
    from: [-74.05, 40.68],
    mode: "ocean",
    carrier: "Maersk",
    progress: 62,
    status: "In transit",
  },
];
