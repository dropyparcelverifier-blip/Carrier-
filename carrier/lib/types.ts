/* ================================================================
   DotConnects Logistics order-tracking data model
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
  | "qc_check"
  | "handed_to_courier";

export type StageState = "done" | "current" | "pending" | "exception";

export type ShipmentMode = "Air Freight" | "Ocean Freight" | "Express Air";

export type ShipmentStatus =
  | "Order Placed"
  | "Processing"
  | "In Transit"
  | "Customs Clearance"
  | "At Warehouse"
  | "Received"
  | "Forwarded to Courier"
  /**
   * Hold state, not a point on the journey (architecture §5.2).
   * Written by POST /api/admin/orders/[id]/damaged. Added to the union
   * at M7 — the route was already writing this string, so the type was
   * lying about what the column can contain.
   */
  | "Damaged in transit";

export type TrackingEvent = {
  stage: StageKey;
  label: string;
  location: string;
  timestamp: string;
  note?: string;
  state: StageState;
  /**
   * Set on the first-mile pickup stage (vendor -> DotConnects Logistics warehouse)
   * AND the handed_to_courier stage (Vashi -> doorstep) — the two legs
   * where the mover genuinely differs from the shipment's main
   * international carrier, which is already shown once at order-level.
   */
  carrier?: string;
  /**
   * Only set on handed_to_courier — a link to the last-mile platform's own
   * tracking LANDING page (not a deep link; see lib/last-mile.ts for why).
   * The actual AWB to paste in is shown separately, not embedded in this URL.
   */
  courierLink?: string;
};

export type OrderItem = {
  name: string;
  qty: number;
  weight_g: number;
  /** Only populated for demo data — real orders don't capture per-item price. */
  price_usd?: number;
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
  /** Only set once the order reaches handed_to_courier — see lib/last-mile.ts. */
  lastMileCourier?: string;
  lastMileAwb?: string;
  lastMileTrackingUrl?: string;
  /**
   * Past the shipping window and not yet arrived (architecture §6).
   * Computed at read time, never stored — so DOC calling add-days
   * un-overdues an order immediately with no job to re-run.
   * When true, `eta` is empty: an overdue parcel gets no date, because
   * any date shown would be a guess the customer reads as a promise.
   */
  isOverdue?: boolean;
};

/**
 * 14 canonical stages — DotConnects Logistics origin warehouse → Vashi warehouse →
 * QC → last-mile handover. qc_check and handed_to_courier are both
 * EVENT-DRIVEN, not clock-suggested — see suggestStage below and
 * lib/order-routes.ts effectiveOrderStage, which excludes both from the
 * time-elapsed auto-advance the same way. A real QC pass or a real
 * warehouse handover happens when it happens (an order landing at Vashi 3
 * days early doesn't mean its handover to Shiprocket/Velocity happened
 * early too — that's still a distinct real-world action an employee takes),
 * so both only move forward via an explicit admin action, never a
 * timing_pct-vs-elapsed-time guess. Onward delivery beyond the last-mile
 * handover (i.e. what happens after Shiprocket/Velocity picks up) is still
 * out of scope — this tracks the handover itself, not door-to-door proof
 * of delivery, which is the courier's own tracking page's job (see
 * TrackingEvent.courierLink).
 *
 * Labels are origin-neutral by design — orders originate from five source
 * markets (lib/network.ts ORIGINS), not just the US, so "Packed at origin
 * warehouse" reads correctly for a London or Seoul shipment the same way it
 * does for a Newark one. The actual departure city/airport is carried in
 * each event's `location` field (lib/routes.ts), not baked into this label.
 *
 * timing_pct: what fraction of the total shipping_days has elapsed by this
 * stage — qc_check and handed_to_courier both sit at the 1.00 ceiling since
 * neither is ever reached by the clock (see above); it only matters for
 * STAGE_PROGRESS-style percentage displays, not for auto-suggestion.
 */
export const STAGES: {
  key: StageKey;
  label: string;
  short: string;
  timing_pct: number; // 0–1, cumulative % of shipping days elapsed
}[] = [
  { key: "order_placed",        label: "Order placed",                   short: "Placed",      timing_pct: 0    },
  { key: "processing",          label: "Processing & verification",      short: "Processing",  timing_pct: 0.05 },
  { key: "packed",              label: "Packed at origin warehouse",     short: "Packed",      timing_pct: 0.15 },
  { key: "dispatched",          label: "Dispatched from warehouse",      short: "Dispatched",  timing_pct: 0.20 },
  { key: "at_us_airport",       label: "Arrived at departure gateway",   short: "At Gateway",  timing_pct: 0.25 },
  { key: "us_customs_cleared",  label: "Export clearance complete",      short: "Cleared Out", timing_pct: 0.30 },
  { key: "in_transit_departed", label: "Shipped — departed origin",      short: "Departed",    timing_pct: 0.35 },
  { key: "mid_transit",         label: "In transit — mid journey",       short: "In Transit",  timing_pct: 0.55 },
  { key: "arrived_india",       label: "Arrived in India",               short: "Arrived IN",  timing_pct: 0.70 },
  { key: "indian_customs",      label: "Indian customs clearance",       short: "Customs",     timing_pct: 0.80 },
  { key: "customs_cleared",     label: "Customs cleared",                short: "Cleared",     timing_pct: 0.90 },
  { key: "at_vashi_warehouse",  label: "Received at Vashi warehouse",    short: "Delivered",   timing_pct: 0.95 },
  { key: "qc_check",            label: "Quality check — approved",       short: "QC Approved", timing_pct: 1.00 },
  { key: "handed_to_courier",   label: "Freight forwarded",               short: "Forwarded",  timing_pct: 1.00 },
];

/**
 * Groups the 14 flat stages into 4 named chapters for the timeline —
 * a 12+ row flat list reads as a log, a handful of named phases reads as
 * a story. Order matches STAGES; every key appears in exactly one phase.
 */
export const STAGE_PHASE: Record<StageKey, string> = {
  order_placed:        "Origin",
  processing:           "Origin",
  packed:                "Origin",
  dispatched:             "Origin",
  at_us_airport:           "Export & transit",
  us_customs_cleared:       "Export & transit",
  in_transit_departed:       "Export & transit",
  mid_transit:                 "Export & transit",
  arrived_india:                 "Arrival & customs",
  indian_customs:                 "Arrival & customs",
  customs_cleared:                  "Arrival & customs",
  at_vashi_warehouse:                "Final mile",
  qc_check:                           "Final mile",
  handed_to_courier:                    "Final mile",
};

/** Given an order_date and shipping_days, return the suggested current StageKey. */
export function suggestStage(orderDate: string, shippingDays: number): StageKey {
  const created = new Date(orderDate).getTime();
  const now = Date.now();
  // Convert shipping_days (working days) to ms — approximate: 1 working day ≈ 1.2 calendar days
  // (matches create-order.ts / order-routes.ts's same conversion — at the
  // 10-day default this lands the promised window at 12 calendar days).
  const totalMs = shippingDays * 1.2 * 24 * 60 * 60 * 1000;
  const elapsed = now - created;
  const ratio = Math.min(elapsed / totalMs, 1);

  // Find the last stage whose timing_pct ≤ ratio. handed_to_courier shares
  // qc_check's 1.00 ceiling (see STAGES's own note) but is a real handover
  // action, not something time-elapsed alone should ever suggest — skipped
  // here the same way lib/order-routes.ts's suggestStageForOrderRoute does.
  let suggested: StageKey = "order_placed";
  for (const s of STAGES) {
    if (s.key === "handed_to_courier") continue;
    if (s.timing_pct <= ratio) suggested = s.key;
  }
  return suggested;
}

/** The stage immediately after the given one, or null if it's the last (or unknown). */
export function nextStage(currentStage: StageKey): (typeof STAGES)[number] | null {
  const idx = STAGES.findIndex((s) => s.key === currentStage);
  if (idx === -1 || idx === STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

/**
 * STAGES' own `label` is written for a stage that's already happened or is
 * happening now ("Quality check — approved", "Customs cleared") — used
 * verbatim as a "what's next" preview it reads as self-contradictory
 * ("Quality check — approved — next"). This is the future-tense phrasing
 * for the same stage, for that preview use only.
 */
const NEXT_STAGE_LABEL: Record<StageKey, string> = {
  order_placed:        "Order will be placed",
  processing:           "Processing & verification",
  packed:                "Packing at origin warehouse",
  dispatched:             "Dispatch from warehouse",
  at_us_airport:           "Arrival at departure gateway",
  us_customs_cleared:       "Export clearance",
  in_transit_departed:       "Departure from origin",
  mid_transit:                 "Mid-journey transit",
  arrived_india:                 "Arrival in India",
  indian_customs:                 "Indian customs clearance",
  customs_cleared:                  "Customs clearance",
  at_vashi_warehouse:                "Arrival at Vashi warehouse",
  qc_check:                           "Quality check",
  handed_to_courier:                    "Handover to last-mile courier",
};

export function nextStageLabel(stage: StageKey): string {
  return NEXT_STAGE_LABEL[stage];
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

/**
 * Display-only — every real order's customer_mobile is stored as a plain
 * 10-digit number (validated in create-order.ts), so this never touches
 * the database. Formats it the way an Indian number is actually written:
 * "+91 83550 12271".
 */
export function formatIndianPhone(mobile: string | null | undefined): string {
  const digits = (mobile ?? "").replace(/\D/g, "");
  if (digits.length !== 10) return mobile ?? "—";
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/**
 * Raw `dotconnects_orders` row shape, as returned by `select("*")` in the admin
 * API routes and consumed directly by AdminClient.tsx (unlike the public
 * `/api/track` response, which maps rows through shipment-service.ts's
 * `mapRow` into the display-oriented `Shipment` shape above).
 */
export type AdminOrderItem = {
  name: string;
  qty: number;
  weight_g: number;
  sku?: string;
  /** Only ever set when Order Central sent it explicitly — see lib/vendor-catalog.ts CategorizedItem. */
  category?: string;
};

export type AdminOrder = {
  id: string;
  created_at: string;
  us_order_id: string;
  dotconnects_order_id: string;
  tracking_id: string;
  origin_country: string;
  route_key: string | null;
  timing_seed: number;
  customer_name: string;
  customer_mobile: string;
  customer_email: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_pincode: string | null;
  items: AdminOrderItem[] | string;
  total_weight_kg: number;
  total_items: number;
  shipping_days: number;
  shipping_mode: string;
  current_stage: StageKey;
  status: ShipmentStatus | string;
  progress: number;
  estimated_delivery: string;
  actual_delivery?: string | null;
  carrier_name: string | null;
  awb_number: string | null;
  /** Last-mile handover (Vashi -> doorstep) — distinct from awb_number's
   *  international leg. See lib/last-mile.ts. */
  last_mile_courier: string | null;
  last_mile_awb: string | null;
  /** Real URL synced from Order Central (scripts/sync-last-mile.js) —
   *  takes priority over a template-constructed link when present. */
  last_mile_tracking_url: string | null;
  admin_notes: string | null;
  payment_status: string;
};

export type AdminOrderEvent = {
  id: string;
  order_id: string;
  stage: StageKey;
  label: string;
  location: string;
  carrier?: string | null;
  happened_at: string;
  note: string | null;
  state: StageState;
  sort_order: number;
};

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
