import { DEMO_SHIPMENTS } from "./demo-data";
import { getSupabaseAdmin } from "./supabase-admin";
import { matchesQuery, STAGES, type OrderItem, type Shipment, type TrackingEvent } from "./types";
import { effectiveOrderStage, orderRouteStageLocation, orderRouteStageCarrier } from "./order-routes";
import { STAGE_PROGRESS, stageToStatus } from "./admin-stages";
import { resolveVendor } from "./vendor-catalog";
import { courierTrackingUrl } from "./last-mile";

export type DataSource = "supabase" | "demo";
export type ShipmentResult = { shipments: Shipment[]; source: DataSource };

type EventRow = {
  stage: string; label: string; location: string; carrier?: string | null;
  happened_at: string; note: string | null; state: string; sort_order: number;
};

/** courierLink is derived, not stored — computed here from carrier +
 *  the order's own last_mile_awb/last_mile_tracking_url (an EventRow has
 *  neither of its own — only the parent order does) so it resolves a
 *  synced real URL when one exists, or a deep link built from the AWB
 *  otherwise. */
function toTrackingEvent(e: EventRow, lastMileAwb?: string | null, lastMileTrackingUrl?: string | null): TrackingEvent {
  return {
    stage: e.stage as TrackingEvent["stage"],
    label: e.label, location: e.location,
    timestamp: e.happened_at, note: e.note ?? undefined,
    state: e.state as TrackingEvent["state"],
    carrier: e.carrier ?? undefined,
    courierLink: e.stage === "handed_to_courier" ? courierTrackingUrl(e.carrier, lastMileAwb, lastMileTrackingUrl) ?? undefined : undefined,
  };
}

type OrderRow = {
  tracking_id: string; dropy_order_id: string; customer_name: string;
  customer_mobile: string; customer_city: string; items: OrderItem[] | string;
  total_weight_kg: number; total_items: number; declared_value_usd: number;
  shipping_days: number; shipping_mode: string; current_stage: string;
  route_key: string | null; timing_seed: number | null;
  status: string; progress: number; estimated_delivery: string;
  carrier_name: string; awb_number: string | null; admin_notes: string | null;
  last_mile_courier: string | null; last_mile_awb: string | null;
  last_mile_tracking_url: string | null;
  order_date: string; dropy_order_events: EventRow[] | null;
};

function mapRow(row: OrderRow): Shipment {
  const dbEvents: TrackingEvent[] = (row.dropy_order_events ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => toTrackingEvent(e, row.last_mile_awb, row.last_mile_tracking_url));

  // Live progress: current_stage only moves on a manual admin action, so on
  // its own it goes stale. If the route's time-elapsed stage is further
  // along, surface that instead — without waiting for anyone to click
  // "Save changes" — and inject a synthetic event so the timeline shows it.
  // timing_seed jitters each order's stage-timing slightly (see
  // lib/order-routes.ts jitterTimingPct) so orders placed the same day
  // don't all flip stages at the exact same hour-mark.
  const liveStage = effectiveOrderStage(row.route_key, row.current_stage, row.order_date, row.shipping_days, row.timing_seed ?? 0);
  const stageInfo = STAGES.find((s) => s.key === liveStage);
  const events = dbEvents;
  const items: OrderItem[] = typeof row.items === "string" ? JSON.parse(row.items) : (row.items || []);
  const vendor = resolveVendor(items, row.timing_seed ?? 0);
  // "exception" is a hold, not a real place on the route — the DB event
  // already carries its own note/location (set at PATCH time), so it never
  // needs (and shouldn't get) a synthetic "In progress" event appended.
  if (liveStage !== row.current_stage && stageInfo && row.current_stage !== "exception") {
    const lastReal = events[events.length - 1];
    if (lastReal && lastReal.state === "current") lastReal.state = "done";
    events.push({
      stage: liveStage as TrackingEvent["stage"],
      label: stageInfo.label,
      location: orderRouteStageLocation(row.route_key, liveStage as TrackingEvent["stage"], vendor),
      timestamp: "In progress",
      state: "current",
      carrier: orderRouteStageCarrier(liveStage as TrackingEvent["stage"], vendor),
    });
  }

  const effectiveProgress = liveStage !== row.current_stage
    ? (STAGE_PROGRESS[liveStage] ?? row.progress)
    : row.progress;

  // Origin text now comes from the resolved vendor (see lib/vendor-catalog.ts)
  // rather than the route's own generic processing location — a real
  // order's "origin" is the vendor it actually shipped from (e.g. "CeraVe /
  // L'Oreal USA Distribution, Newark, NJ"), not just a bare warehouse city.
  const originWarehouse = orderRouteStageLocation(row.route_key, "processing", vendor);

  return {
    id: row.tracking_id,
    reference: row.dropy_order_id,
    consignee: row.customer_name,
    consigneeCity: row.customer_city,
    contactName: row.customer_name,
    description: items.map((it) => it.name).join(", ") || "Order items",
    category: "Personal Care & Lifestyle",
    brands: [...new Set(items.map((it) => it.name?.split(" ")[0] || ""))].filter(Boolean) as string[],
    status: stageToStatus(liveStage) as Shipment["status"],
    mode: row.shipping_mode as Shipment["mode"],
    origin: originWarehouse,
    originPort: originWarehouse,
    destination: `${row.customer_city}, India`,
    destinationPort: "DotConnects Logistics Vashi Warehouse — Navi Mumbai",
    carrier: row.carrier_name || "DotConnects Logistics",
    containerOrAwb: row.awb_number || "—",
    pieces: 1, skuCount: items.length, batchCount: 1,
    weightKg: row.total_weight_kg,
    declaredValueUsd: row.declared_value_usd,
    hsCode: "—", dutyPaid: ["at_vashi_warehouse", "qc_check", "handed_to_courier"].includes(liveStage),
    cdscoRegistration: null, fssaiLicence: null,
    shelfLifeRemaining: "", tempControlled: false,
    shippedOn: new Date(row.order_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    eta: row.estimated_delivery || "—",
    progress: effectiveProgress,
    events, items,
    totalItems: row.total_items,
    shippingDays: row.shipping_days,
    customerMobile: row.customer_mobile,
    adminNotes: row.admin_notes ?? undefined,
    lastMileCourier: row.last_mile_courier ?? undefined,
    lastMileAwb: row.last_mile_awb ?? undefined,
    lastMileTrackingUrl: courierTrackingUrl(row.last_mile_courier, row.last_mile_awb, row.last_mile_tracking_url) ?? undefined,
  };
}

const SELECT = `
  tracking_id, dropy_order_id, customer_name, customer_mobile, customer_city,
  items, total_weight_kg, total_items, declared_value_usd, shipping_days,
  shipping_mode, current_stage, route_key, timing_seed, status, progress, estimated_delivery,
  carrier_name, awb_number, last_mile_courier, last_mile_awb, last_mile_tracking_url, admin_notes, order_date,
  dropy_order_events (stage, label, location, carrier, happened_at, note, state, sort_order)
`;

/**
 * Returns EVERY order, unfiltered — unlike searchShipments, there's no
 * tracking-ID/phone check gating this. Currently unused (no route calls
 * it), which is exactly right: only wire this up behind requireAdminSession()
 * (see lib/admin-session.ts), never into a public API route.
 */
export async function listShipments(): Promise<ShipmentResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { shipments: DEMO_SHIPMENTS, source: "demo" };

  const { data, error } = await supabase
    .from("dropy_orders").select(SELECT).order("order_date", { ascending: false });

  // Fall back to demo if error OR database is empty (not seeded yet)
  if (error || !data?.length) {
    return { shipments: DEMO_SHIPMENTS, source: "demo" };
  }
  return { shipments: (data as unknown as OrderRow[]).map(mapRow), source: "supabase" };
}

export type SearchScope = { allowNameSearch?: boolean; phone?: string };

export async function searchShipments(
  query: string,
  scope: SearchScope = {},
): Promise<ShipmentResult> {
  const q = query.trim();
  if (!q) return { shipments: [], source: "demo" };

  const supabase = getSupabaseAdmin();

  if (supabase) {
    // Build query: match tracking_id OR dropy_order_id OR us_order_id, AND phone if provided
    const orFilter = `tracking_id.eq.${q},dropy_order_id.eq.${q},us_order_id.eq.${q}`;

    const request = scope.phone
      ? supabase.from("dropy_orders").select(SELECT).or(orFilter).eq("customer_mobile", scope.phone.trim()).limit(5)
      : supabase.from("dropy_orders").select(SELECT).or(orFilter).limit(5);

    const { data, error } = await request;

    // Only use Supabase result if it actually found something
    // If empty (DB not seeded), fall through to demo data below
    if (!error && data && data.length > 0) {
      return {
        shipments: (data as unknown as OrderRow[]).map(mapRow),
        source: "supabase",
      };
    }
  }

  // Demo fallback — match tracking ID then verify phone
  let results = DEMO_SHIPMENTS.filter((s) => matchesQuery(s, q, scope));
  if (scope.phone) {
    results = results.filter((s) => s.customerMobile === scope.phone?.trim());
  }
  return { shipments: results, source: "demo" };
}
