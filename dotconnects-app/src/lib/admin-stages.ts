/**
 * Shared between AdminClient.tsx (display) and the admin API routes
 * (server-side update logic) so the two can't drift — this used to be
 * defined only in AdminClient.tsx, with the write logic duplicated in the
 * component itself before writes moved server-side.
 */
export const STAGE_PROGRESS: Record<string, number> = {
  order_placed: 0, processing: 7, packed: 15, dispatched: 22,
  at_us_airport: 29, us_customs_cleared: 36, in_transit_departed: 45,
  mid_transit: 58, arrived_india: 70, indian_customs: 80,
  customs_cleared: 90, at_vashi_warehouse: 97, qc_check: 100,
  // Stays at 100 — handed_to_courier is a real event past qc_check (see
  // STAGES's own note in lib/types.ts), not a later point on the SAME
  // 0-100% progress bar. This app's own scope ends at the handover; going
  // to 101%+ would just look like a bug on the progress UI, not "more done
  // than done." The distinct StageKey/timestamp/event already record that
  // the handover genuinely happened later than qc_check, without needing
  // the number itself to exceed 100.
  handed_to_courier: 100,
};

export const STAGE_LOCATIONS: Record<string, string> = {
  order_placed: "dotconnectslogistics.com", processing: "DotConnects Logistics Warehouse, Newark, NJ",
  packed: "DotConnects Logistics Warehouse, Newark, NJ", dispatched: "Newark, NJ, USA",
  at_us_airport: "JFK / EWR Airport, USA", us_customs_cleared: "US Airport",
  in_transit_departed: "Airspace — en route to Mumbai", mid_transit: "International airspace",
  arrived_india: "Chhatrapati Shivaji Intl Airport (BOM)",
  indian_customs: "Sahar Air Cargo Complex, Mumbai", customs_cleared: "Mumbai, India",
  at_vashi_warehouse: "Dropy Warehouse, Vashi, Navi Mumbai",
  qc_check: "Dropy Warehouse, Vashi, Navi Mumbai",
  handed_to_courier: "Dropy Warehouse, Vashi, Navi Mumbai",
};

export const PAYMENT_STATUSES = ["Unpaid", "Partially Paid", "Fully Paid", "Cash on Delivery", "Refunded"] as const;

export function stageToStatus(stage: string): string {
  if (stage === "order_placed") return "Order Placed";
  if (["processing", "packed"].includes(stage)) return "Processing";
  if (["dispatched", "at_us_airport", "us_customs_cleared", "in_transit_departed", "mid_transit"].includes(stage)) return "In Transit";
  if (["arrived_india", "indian_customs", "customs_cleared"].includes(stage)) return "Customs Clearance";
  if (stage === "at_vashi_warehouse") return "At Warehouse";
  if (stage === "qc_check") return "Received";
  if (stage === "handed_to_courier") return "Forwarded to Courier";
  return "Order Placed";
}
