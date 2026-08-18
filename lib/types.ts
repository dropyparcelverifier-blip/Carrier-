/* ================================================================
   Dropy order-tracking data model
   ================================================================ */

export type StageKey =
  | "order_placed"
  | "processing"
  | "packed"
  | "dispatched"
  | "at_us_airport"
  | "us_customs_cleared"
  | "in_transit_departed"
  | "mid_transit"
  | "arrived_india"
  | "indian_customs"
  | "customs_cleared"
  | "at_vashi_warehouse"
  | "qc_check";

export type StageState = "done" | "current" | "pending" | "exception";

export type ShipmentMode = "Air Freight" | "Ocean Freight" | "Express Air";

export type ShipmentStatus =
  | "Order Placed"
  | "Processing"
  | "In Transit"
  | "Customs Clearance"
  | "At Warehouse"
  | "Received";

export type TrackingEvent = {
  stage: StageKey;
  label: string;
  location: string;
  timestamp: string;
  note?: string;
  state: StageState;
};

export type OrderItem = {
  name: string;
  qty: number;
  weight_g: number;
  price_usd: number;
  sku?: string;
};

export type Shipment = {
  id: string;
  reference: string;
  consignee: string;
  consigneeCity: string;
  contactName: string;
  description: string;
  category: string;
  brands: string[];
  status: ShipmentStatus;
  mode: ShipmentMode;
  origin: string;
  originPort: string;
  destination: string;
  destinationPort: string;
  carrier: string;
  containerOrAwb: string;
  pieces: number;
  skuCount: number;
  batchCount: number;
  weightKg: number;
  declaredValueUsd: number;
  hsCode: string;
  dutyPaid: boolean;
  cdscoRegistration: string | null;
  fssaiLicence: string | null;
  shelfLifeRemaining: string;
  mrpLabelling: "Not started" | "In progress" | "Complete";
  tempControlled: boolean;
  shippedOn: string;
  eta: string;
  progress: number;
  events: TrackingEvent[];
  items?: OrderItem[];
  totalItems?: number;
  shippingDays?: number;
  customerMobile?: string;
  estimatedDelivery?: string;
  adminNotes?: string;
};

/**
 * 13 canonical stages — Dropy USA warehouse → Vashi warehouse → QC.
 * QC check is the final handoff point; onward delivery is another vendor's
 * scope. Arrival at Vashi is a distinct, non-final stage — goods sit there
 * pending the quality check before being marked approved.
 *
 * timing_pct: what fraction of the total shipping_days has elapsed by this stage.
 * Used to auto-suggest the current stage based on elapsed time.
 */
export const STAGES: {
  key: StageKey;
  label: string;
  short: string;
  timing_pct: number; // 0–1, cumulative % of shipping days elapsed
}[] = [
  { key: "order_placed",        label: "Order placed",                   short: "Placed",      timing_pct: 0    },
  { key: "processing",          label: "Processing & verification",      short: "Processing",  timing_pct: 0.05 },
  { key: "packed",              label: "Packed at USA warehouse",        short: "Packed",      timing_pct: 0.15 },
  { key: "dispatched",          label: "Dispatched from warehouse",      short: "Dispatched",  timing_pct: 0.20 },
  { key: "at_us_airport",       label: "Arrived at US airport",          short: "US Airport",  timing_pct: 0.25 },
  { key: "us_customs_cleared",  label: "US export clearance complete",   short: "US Cleared",  timing_pct: 0.30 },
  { key: "in_transit_departed", label: "Shipped — departed US",          short: "Departed",    timing_pct: 0.35 },
  { key: "mid_transit",         label: "In transit — mid journey",       short: "In Transit",  timing_pct: 0.55 },
  { key: "arrived_india",       label: "Arrived at Mumbai airport (BOM)",short: "Arrived IN",  timing_pct: 0.70 },
  { key: "indian_customs",      label: "Indian customs clearance",       short: "Customs",     timing_pct: 0.80 },
  { key: "customs_cleared",     label: "Customs cleared",                short: "Cleared",     timing_pct: 0.90 },
  { key: "at_vashi_warehouse",  label: "Received at Vashi warehouse",    short: "Delivered",   timing_pct: 0.95 },
  { key: "qc_check",            label: "Quality check — approved",       short: "QC Approved", timing_pct: 1.00 },
];

/** Given an order_date and shipping_days, return the suggested current StageKey. */
export function suggestStage(orderDate: string, shippingDays: number): StageKey {
  const created = new Date(orderDate).getTime();
  const now = Date.now();
  // Convert shipping_days (working days) to ms — approximate: 1 working day ≈ 1.4 calendar days
  const totalMs = shippingDays * 1.4 * 24 * 60 * 60 * 1000;
  const elapsed = now - created;
  const ratio = Math.min(elapsed / totalMs, 1);

  // Find the last stage whose timing_pct ≤ ratio
  let suggested: StageKey = "order_placed";
  for (const s of STAGES) {
    if (s.timing_pct <= ratio) suggested = s.key;
  }
  return suggested;
}

export function currentEvent(shipment: Shipment): TrackingEvent {
  return (
    shipment.events.find((e) => e.state === "exception") ??
    shipment.events.find((e) => e.state === "current") ??
    shipment.events[shipment.events.length - 1]
  );
}

/**
 * Declared value and item prices are captured in USD — that's genuinely
 * the currency the goods were purchased in from a US seller, not a choice
 * made on this site. But the customer-facing experience is Rupees end to
 * end (see lib/quote.ts), so this converts for display rather than
 * showing a mixed $/₹ page. Same indicative rate used to derive the
 * quote's freight pricing — not a live FX rate, just enough to show a
 * realistic ballpark rather than the raw USD figure.
 */
const INR_PER_USD = 83;
const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export function usdToInrFormatted(amountUsd: number): string {
  return inrFormatter.format(amountUsd * INR_PER_USD);
}

export function matchesQuery(
  s: Shipment,
  rawQuery: string,
  opts: { allowNameSearch?: boolean } = {},
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return false;
  const loose = (v: string) => v.toLowerCase().replace(/[\s-]/g, "");
  const ql = loose(q);
  const exact = loose(s.id) === ql || loose(s.reference) === ql || loose(s.containerOrAwb) === ql;
  if (exact) return true;
  if (!opts.allowNameSearch) return false;
  return s.consignee.toLowerCase().includes(q) || s.contactName.toLowerCase().includes(q);
}
