import { STAGES, type StageKey } from "./types";
import type { VendorProfile } from "./vendor-catalog";

/**
 * The REAL route data used when a new order is actually created —
 * deliberately separate from lib/routes.ts's 22 routes, which exist for
 * display/demo purposes only (About page, tracking demo data) and are not
 * wired into order creation.
 *
 * Verified against real air-cargo geography, not invented: Newark (EWR) and
 * New York (JFK) are the only two US cities with a genuine NON-STOP flight
 * to Mumbai (BOM) — both operated exclusively by Air India on 777
 * equipment, carrying belly cargo. No other US gateway (Chicago, LA, etc.)
 * has a direct-to-Mumbai option even via dedicated freighter — the
 * distance exceeds practical freighter range, which is why every other
 * route in lib/routes.ts (LA, Chicago, Miami, ...) genuinely needs a
 * transit hub. Every real order therefore ships direct, no transit hub,
 * from one of these two cities.
 */
export type OrderRouteStage = { location: string; timing_pct: number };
export type OrderRoute = {
  key: string;
  label: string;
  city: string;
  airportCode: string;
  carrier: string;
  stages: Record<StageKey, OrderRouteStage>;
};

function orderRoute(
  key: string,
  label: string,
  city: string,
  airportCode: string,
  carrier: string,
  points: [string, number][],
): OrderRoute {
  if (points.length !== STAGES.length) {
    throw new Error(`Order route ${key} must have exactly ${STAGES.length} stage points, got ${points.length}`);
  }
  const stages = {} as Record<StageKey, OrderRouteStage>;
  STAGES.forEach((s, i) => {
    stages[s.key] = { location: points[i][0], timing_pct: points[i][1] };
  });
  return { key, label, city, airportCode, carrier, stages };
}

/*
 * timing_pct schedule below is deliberately NOT evenly spaced or copied
 * from lib/routes.ts's display routes. At the default 10 working days
 * (-> 12 calendar days, see create-order.ts's 1.2x conversion), a strict
 * "every stage takes >=24h" rule leaves zero slack across 12 real
 * stage-transitions (12 * 24h = 288h = exactly 12 days) — no room to give
 * the genuinely long legs more time than a same-day customs stamp or
 * warehouse scan. So gaps here are hand-allocated by realistic duration
 * instead: quick same-day steps (packed, dispatched: 8-10h) are short,
 * and the two long-haul transit legs (in_transit_departed/mid_transit,
 * crossing the Atlantic then the Arabian Sea) each get 60h — the bulk of
 * the window — matching how a real 12-day shipment actually paces, not
 * an artificial even split.
 */
export const ORDER_ROUTES: OrderRoute[] = [
  orderRoute(
    "newark-mumbai-direct",
    "Newark -> Mumbai (direct) -> Vashi",
    "Newark, NJ",
    "EWR",
    "Air India Cargo",
    [
      ["dotconnectslogistics.in", 0],
      ["DotConnects Logistics USA Warehouse, Newark, NJ", 0.0625],
      ["DotConnects Logistics USA Warehouse, Newark, NJ", 0.0972],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1250],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1736],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.2083],
      ["Airspace over the Atlantic — nonstop to Mumbai (Air India)", 0.4167],
      ["Airspace over the Arabian Sea — nonstop to Mumbai (Air India)", 0.6250],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.6736],
      ["Sahar Air Cargo Complex, Mumbai", 0.7569],
      ["Mumbai, Maharashtra", 0.8056],
      ["DotConnects Logistics Warehouse, Vashi, Navi Mumbai", 0.8750],
      ["DotConnects Logistics Warehouse, Vashi, Navi Mumbai", 1.00],
      ["DotConnects Logistics Warehouse, Vashi, Navi Mumbai", 1.00],
    ],
  ),

  orderRoute(
    "newyork-mumbai-direct",
    "New York (JFK) -> Mumbai (direct) -> Vashi",
    "New York, NY",
    "JFK",
    "Air India Cargo",
    [
      ["dotconnectslogistics.in", 0],
      ["DotConnects Logistics USA Warehouse, New York, NY", 0.0625],
      ["DotConnects Logistics USA Warehouse, New York, NY", 0.0972],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.1250],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.1736],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.2083],
      ["Airspace over the Atlantic — nonstop to Mumbai (Air India)", 0.4167],
      ["Airspace over the Arabian Sea — nonstop to Mumbai (Air India)", 0.6250],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.6736],
      ["Sahar Air Cargo Complex, Mumbai", 0.7569],
      ["Mumbai, Maharashtra", 0.8056],
      ["DotConnects Logistics Warehouse, Vashi, Navi Mumbai", 0.8750],
      ["DotConnects Logistics Warehouse, Vashi, Navi Mumbai", 1.00],
      ["DotConnects Logistics Warehouse, Vashi, Navi Mumbai", 1.00],
    ],
  ),
];

/**
 * Per-order timing jitter — without this, two orders placed the same day
 * would advance through every stage at the exact same hour-mark, which
 * reads as mechanical once you compare a couple of live orders side by
 * side. `seed` is a small integer (0-9999) generated once at order
 * creation and stored on the row (dropy_orders.timing_seed), so the same
 * order always jitters the same way on every page load — "looks random,
 * stays stable" — rather than the displayed stage flickering between
 * visits if this re-randomised on each render.
 */
export function jitterTimingPct(basePct: number, seed: number, stageIndex: number): number {
  if (basePct <= 0 || basePct >= 1) return basePct;
  // A simple deterministic hash of (seed, stageIndex) -> [-1, 1], no Math.random().
  const h = Math.sin(seed * 12.9898 + stageIndex * 78.233) * 43758.5453;
  const unit = (h - Math.floor(h)) * 2 - 1; // -1..1
  const jitterRange = 0.015; // ±1.5 percentage points — enough to de-sync
                              // orders without ever closing a 24h-floor gap
  return Math.max(0.001, Math.min(0.999, basePct + unit * jitterRange));
}

export function randomTimingSeed(): number {
  return Math.floor(Math.random() * 10000);
}

export function getOrderRoute(routeKey: string | null | undefined): OrderRoute {
  return ORDER_ROUTES.find((r) => r.key === routeKey) ?? ORDER_ROUTES[0];
}

export function pickOrderRoute(): OrderRoute {
  return ORDER_ROUTES[Math.floor(Math.random() * ORDER_ROUTES.length)];
}

/**
 * Stages before the goods reach the airport reflect where they actually are
 * in a real pipeline: "processing" happens at the vendor itself (being
 * picked/verified against the order), "packed"/"dispatched" happen at the
 * DotConnects Logistics pickup warehouse in the SAME city the vendor already ships
 * from (a real 3PL consolidates locally, it doesn't truck a vendor's stock
 * across state lines before even leaving for the airport) — everything
 * from at_us_airport onward is unaffected by vendor since it's already
 * consolidated onto the fixed Newark/JFK route by then.
 */
const VENDOR_STAGES: StageKey[] = ["processing", "packed", "dispatched"];

export function orderRouteStageLocation(
  routeKey: string | null | undefined,
  stage: StageKey,
  vendor?: { profile: VendorProfile; name: string },
): string {
  if (vendor && VENDOR_STAGES.includes(stage)) {
    // Two distinct real facilities on the US side, both OURS — never the
    // vendor's own name (e.g. "CeraVe / L'Oreal USA Distribution"), which
    // reads as us operating out of that vendor's facility. "Processing &
    // verification" happens at the receiving/QC facility ("Dropy
    // Warehouse" — the original brand name, still the real name of this
    // specific facility); the item then moves to "DotConnects Logistics
    // Warehouse" for the Packed/Dispatched stages, where it's consolidated
    // for the actual air-freight leg. Only the CITY varies with the
    // vendor (a real order's product can ship from any of several US
    // vendor cities) — the facility names themselves are fixed.
    if (stage === "processing") return `Dropy Warehouse, ${vendor.profile.warehouseCity}, ${vendor.profile.warehouseState}`;
    return `DotConnects Logistics Warehouse, ${vendor.profile.warehouseCity}, ${vendor.profile.warehouseState}`;
  }
  return getOrderRoute(routeKey).stages[stage]?.location ?? "";
}

/** Only set for the vendor-pickup leg (see VENDOR_STAGES) — every other
 *  stage uses the order's main carrier (Air India Cargo), shown once at
 *  the order level rather than repeated on every timeline row. */
export function orderRouteStageCarrier(stage: StageKey, vendor?: { profile: VendorProfile }): string | undefined {
  if (vendor && stage === "dispatched") return vendor.profile.pickupCarrier;
  return undefined;
}

/**
 * Same time-elapsed suggestion logic as lib/routes.ts's suggestStageForRoute,
 * plus per-order jitter (see jitterTimingPct) so two orders on the same
 * route/shipping_days don't advance in perfect lockstep. `seed` is the
 * order's stored dropy_orders.timing_seed; pass 0 (or omit) for unseeded
 * callers, which is equivalent to no jitter.
 */
export function suggestStageForOrderRoute(
  routeKey: string | null | undefined,
  orderDate: string,
  shippingDays: number,
  seed = 0,
): StageKey {
  const route = getOrderRoute(routeKey);
  const created = new Date(orderDate).getTime();
  const now = Date.now();
  // shippingDays is working days — 1.2x converts to calendar days
  // (weekends included), matching create-order.ts's ETA computation.
  const totalMs = shippingDays * 1.2 * 24 * 60 * 60 * 1000;
  const elapsed = now - created;
  const ratio = Math.min(elapsed / totalMs, 1);

  let suggested: StageKey = "order_placed";
  STAGES.forEach((s, i) => {
    // handed_to_courier shares qc_check's 1.00 timing_pct ceiling (see
    // STAGES's own note) but is never something the clock should suggest —
    // it's a real handover action, not a time-elapsed inference. Excluding
    // it here keeps qc_check as the actual clock-reachable ceiling.
    if (s.key === "handed_to_courier") return;
    const pct = seed ? jitterTimingPct(route.stages[s.key].timing_pct, seed, i) : route.stages[s.key].timing_pct;
    if (pct <= ratio) suggested = s.key;
  });
  return suggested;
}

/**
 * Same "manual update never regresses" logic as lib/routes.ts's
 * effectiveStage — "exception" additionally covers any delay reason (see
 * lib/delay-reasons.ts), not just a generic hold, and never auto-advances
 * via the clock the same way qc_check/handed_to_courier don't: both are
 * real actions an employee takes (a QC pass, a physical handover to
 * Shiprocket/Velocity), not something that just happens once enough time
 * has elapsed — an admin has to set each explicitly.
 * suggestStageForOrderRoute already excludes handed_to_courier from what
 * the clock can propose (see its own note), so the guard here just
 * prevents regressing a dbStage that's already sitting at one of these
 * two states back down to whatever the clock currently suggests.
 */
export function effectiveOrderStage(
  routeKey: string | null | undefined,
  dbStage: string,
  orderDate: string,
  shippingDays: number,
  seed = 0,
): string {
  if (dbStage === "qc_check" || dbStage === "handed_to_courier" || dbStage === "exception") return dbStage;
  const suggested = suggestStageForOrderRoute(routeKey, orderDate, shippingDays, seed);
  const dbIdx = STAGES.findIndex((s) => s.key === dbStage);
  const suggestedIdx = STAGES.findIndex((s) => s.key === suggested);
  return suggestedIdx > dbIdx ? suggested : dbStage;
}
