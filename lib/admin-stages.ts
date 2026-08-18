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
};

export const STAGE_LOCATIONS: Record<string, string> = {
  order_placed: "dropy.in", processing: "Dropy USA Warehouse, Newark, NJ",
  packed: "Dropy USA Warehouse, Newark, NJ", dispatched: "Newark, NJ, USA",
  at_us_airport: "JFK / EWR Airport, USA", us_customs_cleared: "US Airport",
  in_transit_departed: "Airspace — en route to Mumbai", mid_transit: "International airspace",
  arrived_india: "Chhatrapati Shivaji Intl Airport (BOM)",
  indian_customs: "Sahar Air Cargo Complex, Mumbai", customs_cleared: "Mumbai, India",
  at_vashi_warehouse: "Dropy Warehouse, Vashi, Navi Mumbai",
  qc_check: "Dropy Warehouse, Vashi, Navi Mumbai",
};

export const PAYMENT_STATUSES = ["Unpaid", "Partially Paid", "Fully Paid", "Cash on Delivery", "Refunded"] as const;

export function stageToStatus(stage: string): string {
  if (stage === "order_placed") return "Order Placed";
  if (["processing", "packed"].includes(stage)) return "Processing";
  if (["dispatched", "at_us_airport", "us_customs_cleared", "in_transit_departed", "mid_transit"].includes(stage)) return "In Transit";
  if (["arrived_india", "indian_customs", "customs_cleared"].includes(stage)) return "Customs Clearance";
  if (stage === "at_vashi_warehouse") return "At Warehouse";
  if (stage === "qc_check") return "Received";
  return "Order Placed";
}
