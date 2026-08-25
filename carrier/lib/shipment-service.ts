import { DEMO_SHIPMENTS } from "./demo-data";
import { getSupabaseAdmin } from "./supabase-admin";
import { matchesQuery, STAGES, type OrderItem, type Shipment, type TrackingEvent } from "./types";
import { effectiveOrderStage, orderRouteStageLocation, orderRouteStageCarrier, stageHappenedAt } from "./order-routes";
import { nowIST } from "./dates";
import { STAGE_PROGRESS, stageToStatus } from "./admin-stages";
import { resolveVendor } from "./vendor-catalog";
import { courierTrackingUrl } from "./last-mile";
import {
  anchorFromRow, anchoredSuggestedStage, resolveStageTime,
  compressSkippedStages, stagesBetween, computeOverdue,
} from "@/lib/stage-clock";

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
  // M3 — stage clock (architecture §4, §5.1). All nullable: null means
  // "today's behaviour", so existing rows are unaffected.
  clock_anchor_stage: string | null; clock_anchor_at: string | null;
  label_generated_at: string | null; picked_up_at: string | null;
  delivered_at: string | null;
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
  // M3 — architecture §4 and §7.
  const anchor = anchorFromRow(row.clock_anchor_stage, row.clock_anchor_at);

  // Two stages are now driven by REAL events rather than the clock:
  // qc_check by label generation, handed_to_courier by courier pickup.
  // These win outright — a real event beats any elapsed-time inference.
  const realEventStage: string | null =
    row.picked_up_at ? "handed_to_courier"
    : row.label_generated_at ? "qc_check"
    : null;

  const clockStage = anchor
    ? (anchoredSuggestedStage(row.route_key, row.order_date, row.shipping_days, anchor) ?? row.current_stage)
    : effectiveOrderStage(row.route_key, row.current_stage, row.order_date, row.shipping_days, row.timing_seed ?? 0);

  const liveStage = realEventStage ?? clockStage;

  // Overdue is computed, never stored (architecture §6) — so DOC calling
  // add-days un-overdues an order immediately, with no job to re-run.
  // Overdue is judged on REAL arrival events, never on the derived
  // stage: an order 20 days into a 12-day window has its clock at 100%,
  // so liveStage is qc_check, so "is qc_check overdue?" answers no — and
  // every overdue order would report as fine. See computeOverdue.
  const overdue = computeOverdue({
    orderDate: row.order_date,
    shippingDays: row.shipping_days,
    storedStage: row.current_stage,
    labelGeneratedAt: row.label_generated_at,
    pickedUpAt: row.picked_up_at,
  });

  // Single source for "when did this stage happen", so the anchor cannot
  // be honoured in one path and missed in another (task 3.4).
  const stageTime = (stage: TrackingEvent["stage"]) =>
    resolveStageTime(
      row.route_key, stage as any, row.order_date, row.shipping_days,
      row.timing_seed ?? 0, anchor, stageHappenedAt,
    );
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

    // Backfill every stage the clock jumped OVER, not just the one it
    // landed on — an order whose clock advanced straight from
    // order_placed to (say) at_vashi_warehouse genuinely passed through
    // packed/dispatched/customs/etc. along the way, even though no
    // individual DB event was ever written for each one (only two real
    // anchors exist per order — order_placed and, once it happens, the
    // handover). Without this, those stages simply never appeared in the
    // timeline at all — no "done" entry, not even a gap marker — which
    // read as if the shipment teleported. Each gets a real calculated
    // timestamp (stageHappenedAt), not a placeholder string, using the
    // same order_date + timing_pct schedule that decided the order was
    // at liveStage in the first place.
    const lastRealIdx = STAGES.findIndex((s) => s.key === lastReal?.stage);
    const liveIdx = STAGES.findIndex((s) => s.key === liveStage);
    const skipped = STAGES.slice(lastRealIdx + 1, liveIdx)
      .filter((s) => s.key !== "handed_to_courier");

    // CASE 2 (architecture §4). When a real event pulled the order forward
    // — a label generated days before the clock expected it — the skipped
    // stages must be COMPRESSED into the window between where the clock
    // genuinely was and when that event actually happened.
    //
    // Without this the original schedule still applies to them, and an
    // order placed 1 Aug with a label generated 8 Aug renders
    // "Arrived in India — 11 Aug" AFTER "Quality check approved — 8 Aug".
    // The timeline runs backwards and nothing throws.
    const realEventAt =
      row.picked_up_at ? new Date(row.picked_up_at)
      : row.label_generated_at ? new Date(row.label_generated_at)
      : null;

    const compressed =
      realEventAt && skipped.length
        ? compressSkippedStages(
            stagesBetween(lastReal?.stage as any, liveStage as any),
            stageTime(lastReal?.stage as any),
            realEventAt,
          )
        : null;

    skipped.forEach((s) => {
      events.push({
        stage: s.key,
        label: s.label,
        location: orderRouteStageLocation(row.route_key, s.key, vendor),
        timestamp: nowIST(compressed?.get(s.key) ?? stageTime(s.key)),
        state: "done",
        carrier: orderRouteStageCarrier(s.key, vendor),
      });
    });

    events.push({
      stage: liveStage as TrackingEvent["stage"],
      label: stageInfo.label,
      location: orderRouteStageLocation(row.route_key, liveStage as TrackingEvent["stage"], vendor),
      // Same real calculated timestamp as the backfilled "done" stages
      // above, not the placeholder string this used to be — that string
      // was leaking straight into the UI as if it were a real value (the
      // ETA card would headline literally "In progress" instead of a
      // date whenever the live-elapsed stage was ahead of the DB's
      // current_stage, which is the common case for any order an admin
      // hasn't manually advanced yet).
      // A stage driven by a real event carries the REAL timestamp, not a
      // computed one. Showing a calculated time for something we actually
      // know the time of would be strictly worse information.
      timestamp: nowIST(realEventAt ?? stageTime(liveStage as TrackingEvent["stage"])),
      state: "current",
      carrier: orderRouteStageCarrier(liveStage as TrackingEvent["stage"], vendor),
    });
  }

  // Fill in the REMAINING stages the order hasn't reached yet, same as
  // DEMO_SHIPMENTS hand-writes every stage through qc_check including the
  // not-yet-reached ones (state: "pending", no timestamp) — without this,
  // a real order's timeline only ever showed whatever stages a DB event
  // happened to exist for, cutting off after "Processing" instead of
  // showing the rest of the real 13-stage journey still ahead of it.
  // Skipped once there's genuinely nothing further to preview: qc_check
  // (this app's own "handoff still pending" hold, see STAGES's own note in
  // lib/types.ts), handed_to_courier (the real final tracked state), or
  // exception (an active hold, not progress toward anything).
  if (liveStage !== "qc_check" && liveStage !== "handed_to_courier" && liveStage !== "exception") {
    const lastShownIdx = STAGES.findIndex((s) => s.key === events[events.length - 1]?.stage);
    STAGES.slice(lastShownIdx + 1)
      .filter((s) => s.key !== "handed_to_courier") // event-driven only — never previewed as "coming up"
      .forEach((s) => {
        events.push({
          stage: s.key,
          label: s.label,
          location: orderRouteStageLocation(row.route_key, s.key, vendor),
          timestamp: "",
          state: "pending",
          carrier: orderRouteStageCarrier(s.key, vendor),
        });
      });
  }

  const effectiveProgress = liveStage !== row.current_stage
    ? (STAGE_PROGRESS[liveStage] ?? row.progress)
    : row.progress;

  // Origin must be OUR OWN warehouse, not the vendor's name — showing e.g.
  // "CeraVe / L'Oreal USA Distribution, Newark, NJ" as the shipment's
  // ORIGIN reads as an unauthorized brand association (implying that
  // company operates our facility), and breaks down entirely for a
  // multi-vendor cart, which only ever has ONE real pickup warehouse
  // regardless of how many different vendors' items are in it. The vendor
  // name still appears, correctly scoped, in the "processing" stage
  // event's own location text (see orderRouteStageLocation's own note) —
  // that's genuinely describing where an item was sourced/verified, not
  // claiming a facility. "packed" is the stage where the order is
  // actually at OUR warehouse (see VENDOR_STAGES in lib/order-routes.ts).
  const originWarehouse = orderRouteStageLocation(row.route_key, "packed", vendor);

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
    destinationPort: "Dropy Warehouse, Vashi — Navi Mumbai",
    carrier: row.carrier_name || "DotConnects Logistics",
    containerOrAwb: row.awb_number || "—",
    pieces: 1, skuCount: items.length, batchCount: 1,
    weightKg: row.total_weight_kg,
    declaredValueUsd: row.declared_value_usd,
    hsCode: "—", dutyPaid: ["at_vashi_warehouse", "qc_check", "handed_to_courier"].includes(liveStage),
    cdscoRegistration: null, fssaiLicence: null,
    shelfLifeRemaining: "", tempControlled: false,
    shippedOn: new Date(row.order_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    // Overdue orders show NO date (architecture §6, Gate 2 decision).
    // The parcel is past its window and any date we printed would be a
    // guess the customer would read as a promise — the whole reason the
    // delay rule exists is to stop that conversation.
    eta: overdue ? "" : (row.estimated_delivery || "—"),
    isOverdue: overdue,
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

/**
 * Public SELECT — used by /api/track (customer-facing).
 * Deliberately excludes:
 *  - us_order_id  (internal, hidden per requirement)
 *  - admin_notes  (internal ops notes, never for customers)
 */
const SELECT = `
  tracking_id, dropy_order_id, customer_name, customer_mobile, customer_city,
  items, total_weight_kg, total_items, declared_value_usd, shipping_days,
  shipping_mode, current_stage, route_key, timing_seed, status, progress, estimated_delivery,
  carrier_name, awb_number, last_mile_courier, last_mile_awb, last_mile_tracking_url, order_date,
  clock_anchor_stage, clock_anchor_at, label_generated_at, picked_up_at, delivered_at,
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
    .from("dropy_orders").select(SELECT).is("deleted_at", null).order("order_date", { ascending: false });

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
    // Build query: match tracking_id OR dropy_order_id OR us_order_id, AND phone if provided.
    // dropy_order_id also matches by prefix ("Dropy-0000-%") — a multi-leg
    // order (one US order split into several real shipments, each its own
    // leg — see the Order Central bridge route) stores each leg as
    // "Dropy-0000-1", "Dropy-0000-2", never the bare "Dropy-0000" once
    // there's more than one leg. The customer only ever knows their one
    // Shopify order number, so a bare-ID search has to surface every leg,
    // not just an exact (and for a split order, nonexistent) match. The
    // customer_mobile filter below still applies per-row regardless of
    // which branch matched, so a prefix match can't surface a different
    // customer's shipment — only rows whose real phone also matches.
    const escapedQ = q.replace(/[%_]/g, (c) => `\\${c}`);
    const orFilter = `tracking_id.eq.${q},dropy_order_id.eq.${q},dropy_order_id.like.${escapedQ}-%,us_order_id.eq.${q}`;

    const request = scope.phone
      ? supabase.from("dropy_orders").select(SELECT).is("deleted_at", null).or(orFilter).eq("customer_mobile", scope.phone.trim()).limit(5)
      : supabase.from("dropy_orders").select(SELECT).is("deleted_at", null).or(orFilter).limit(5);

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
