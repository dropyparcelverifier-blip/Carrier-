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
    focus: "Daily departures. Consolidation at origin, direct to India.",
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
    focus: "Twice weekly. Heathrow gateway, mixed consignments.",
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
    focus: "Weekly consolidation out of Incheon.",
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
    focus: "Weekly. Small-parcel and precision-packed freight.",
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
    focus: "Weekly. Consolidated mixed-SKU freight.",
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
    note: "Fastest gateway-to-gateway on small, high-value consignments.",
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
    note: "Strong on the UK lane and on time-critical consignments.",
    brand: "#5A3A22",
    mark: "UPS",
    logo: "/carriers/ups.svg",
    logoAspect: "tall",
  },
  {
    name: "Emirates SkyCargo",
    leg: "International air",
    service: "General & dangerous-goods air freight",
    note: "Main uplift for palletised general cargo via Dubai.",
    brand: "#D71921",
    mark: "EK",
    logo: "/carriers/emirates.svg",
    logoAspect: "square",
  },
  {
    name: "Korean Air Cargo",
    leg: "International air",
    service: "General air freight",
    note: "Direct Incheon service. Strong on consolidated consumer goods.",
    brand: "#0F4C97",
    mark: "KE",
    logo: "/carriers/koreanair.svg",
    logoAspect: "wide",
  },
  {
    name: "ANA Cargo",
    leg: "International air",
    service: "General air freight",
    note: "Narita service. Small-parcel and precision-packed freight.",
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
    note: "Same-day and next-day across the destination metro.",
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
    note: "Used for palletised moves out of the destination warehouse.",
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
      "Import registration verified per SKU where the category needs one",
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
  /**
   * Destination [lon, lat].
   *
   * Every arc used to run to one hardcoded HUB constant in NetworkMap,
   * which meant the map could only ever draw hub-and-spoke — five lines
   * into Mumbai. A network with lanes BETWEEN markets needs each lane to
   * carry its own endpoint.
   *
   * Optional: omitted falls back to the India gateway, so the existing
   * inbound lanes keep working unchanged.
   */
  to?: [number, number];
  /** Shown on the lane card. */
  frequency?: string;
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

/**
 * Gateway coordinates. Named so a lane reads as a route rather than four
 * anonymous numbers.
 */
const GW = {
  EWR: [-74.17, 40.69] as [number, number],   // Newark
  JFK: [-73.78, 40.64] as [number, number],
  LHR: [-0.46, 51.47] as [number, number],    // Heathrow
  ICN: [126.45, 37.46] as [number, number],   // Incheon
  NRT: [140.39, 35.77] as [number, number],   // Narita
  SYD: [151.18, -33.94] as [number, number],  // Sydney
  BOM: [72.87, 19.09] as [number, number],    // Mumbai
  DEL: [77.10, 28.56] as [number, number],    // Delhi
};

/**
 * Fourteen lanes across six markets.
 *
 * Was five origins into one Mumbai hub. The business is a network — stock
 * moves between markets, not only inbound — so the map now draws what
 * actually runs.
 *
 * Every lane here is a claim a prospect can ask about. If one stops
 * running, take it out.
 */
export const LANES: Lane[] = [
  /* ── Into India ────────────────────────────────── */
  { id: "us-in",  code: "EWR", city: "Newark",     country: "United States",  from: GW.EWR, to: GW.BOM, mode: "air",   carrier: "Air India Cargo",  progress: 62, frequency: "Daily", status: "In transit" },
  { id: "uk-in",  code: "LHR", city: "London",     country: "United Kingdom", from: GW.LHR, to: GW.BOM, mode: "air",   carrier: "British Airways",  progress: 48, frequency: "Twice weekly", status: "In transit" },
  { id: "kr-in",  code: "ICN", city: "Seoul",      country: "South Korea",    from: GW.ICN, to: GW.BOM, mode: "air",   carrier: "Korean Air Cargo", progress: 35, frequency: "Weekly", status: "Booked" },
  { id: "jp-in",  code: "NRT", city: "Tokyo",      country: "Japan",          from: GW.NRT, to: GW.BOM, mode: "air",   carrier: "ANA Cargo",        progress: 41, frequency: "Weekly", status: "In transit" },
  { id: "au-in",  code: "SYD", city: "Sydney",     country: "Australia",      from: GW.SYD, to: GW.BOM, mode: "air",   carrier: "Qantas Freight",   progress: 27, frequency: "Weekly", status: "Booked" },

  /* ── Out of India ──────────────────────────────── */
  { id: "in-us",  code: "BOM", city: "Mumbai",     country: "India",          from: GW.BOM, to: GW.EWR, mode: "air",   carrier: "Air India Cargo",  progress: 55, frequency: "Twice weekly", status: "In transit" },
  { id: "in-uk",  code: "DEL", city: "Delhi",      country: "India",          from: GW.DEL, to: GW.LHR, mode: "air",   carrier: "British Airways",  progress: 33, frequency: "Weekly", status: "Customs clearance" },
  { id: "in-au",  code: "BOM", city: "Mumbai",     country: "India",          from: GW.BOM, to: GW.SYD, mode: "ocean", carrier: "Maersk",           progress: 18, frequency: "Weekly", status: "Booked" },

  /* ── Between markets ───────────────────────────── */
  { id: "us-uk",  code: "JFK", city: "New York",   country: "United States",  from: GW.JFK, to: GW.LHR, mode: "air",   carrier: "Emirates SkyCargo", progress: 71, frequency: "Daily", status: "At bonded warehouse" },
  { id: "us-jp",  code: "EWR", city: "Newark",     country: "United States",  from: GW.EWR, to: GW.NRT, mode: "air",   carrier: "ANA Cargo",        progress: 44, frequency: "Twice weekly", status: "In transit" },
  { id: "uk-jp",  code: "LHR", city: "London",     country: "United Kingdom", from: GW.LHR, to: GW.NRT, mode: "air",   carrier: "ANA Cargo",        progress: 29, frequency: "Twice weekly", status: "Booked" },
  { id: "kr-jp",  code: "ICN", city: "Seoul",      country: "South Korea",    from: GW.ICN, to: GW.NRT, mode: "air",   carrier: "Korean Air Cargo", progress: 66, frequency: "Weekly", status: "Customs clearance" },
  { id: "jp-au",  code: "NRT", city: "Tokyo",      country: "Japan",          from: GW.NRT, to: GW.SYD, mode: "air",   carrier: "Qantas Freight",   progress: 22, frequency: "Weekly", status: "Booked" },
  { id: "us-au",  code: "JFK", city: "New York",   country: "United States",  from: GW.JFK, to: GW.SYD, mode: "ocean", carrier: "CMA CGM",          progress: 12, frequency: "Weekly", status: "Booked" },
];

