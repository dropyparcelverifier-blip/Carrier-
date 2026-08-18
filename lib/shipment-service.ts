import { DEMO_SHIPMENTS } from "./demo-data";
import { getSupabaseAdmin } from "./supabase-admin";
import { matchesQuery, type Shipment, type TrackingEvent } from "./types";

export type DataSource = "supabase" | "demo";
export type ShipmentResult = { shipments: Shipment[]; source: DataSource };

type EventRow = {
  stage: string; label: string; location: string;
  happened_at: string; note: string | null; state: string; sort_order: number;
};

type OrderRow = {
  tracking_id: string; dropy_order_id: string; customer_name: string;
  customer_mobile: string; customer_city: string; items: any;
  total_weight_kg: number; total_items: number; declared_value_usd: number;
  shipping_days: number; shipping_mode: string; current_stage: string;
  status: string; progress: number; estimated_delivery: string;
  carrier_name: string; awb_number: string | null; admin_notes: string | null;
  order_date: string; dropy_order_events: EventRow[] | null;
};

function stageToStatus(stage: string): Shipment["status"] {
  if (stage === "order_placed") return "Order Placed";
  if (["processing","packed"].includes(stage)) return "Processing";
  if (["dispatched","at_us_airport","us_customs_cleared",
       "in_transit_departed","mid_transit"].includes(stage)) return "In Transit";
  if (["arrived_india","indian_customs","customs_cleared"].includes(stage)) return "Customs Clearance";
  if (stage === "at_vashi_warehouse") return "Received";
  return "Order Placed";
}

function mapRow(row: OrderRow): Shipment {
  const events: TrackingEvent[] = (row.dropy_order_events ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((e) => ({
      stage: e.stage as TrackingEvent["stage"],
      label: e.label, location: e.location,
      timestamp: e.happened_at, note: e.note ?? undefined,
      state: e.state as TrackingEvent["state"],
    }));

  const items = typeof row.items === "string" ? JSON.parse(row.items) : (row.items || []);

  return {
    id: row.tracking_id,
    reference: row.dropy_order_id,
    consignee: row.customer_name,
    consigneeCity: row.customer_city,
    contactName: row.customer_name,
    description: items.map((it: any) => it.name).join(", ") || "Order items",
    category: "Personal Care & Lifestyle",
    brands: [...new Set(items.map((it: any) => it.name?.split(" ")[0] || ""))].filter(Boolean) as string[],
    status: stageToStatus(row.current_stage) as Shipment["status"],
    mode: row.shipping_mode as Shipment["mode"],
    origin: "Newark, NJ, United States",
    originPort: "Dropy USA Warehouse — Newark, NJ",
    destination: `${row.customer_city}, India`,
    destinationPort: "Dropy Vashi Warehouse — Navi Mumbai",
    carrier: row.carrier_name || "Dropy Logistics",
    containerOrAwb: row.awb_number || "—",
    pieces: 1, skuCount: items.length, batchCount: 1,
    weightKg: row.total_weight_kg,
    declaredValueUsd: row.declared_value_usd,
    hsCode: "—", dutyPaid: row.current_stage === "at_vashi_warehouse",
    cdscoRegistration: null, fssaiLicence: null,
    shelfLifeRemaining: "", mrpLabelling: "Not started", tempControlled: false,
    shippedOn: new Date(row.order_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    eta: row.estimated_delivery || "—",
    progress: row.progress,
    events, items,
    totalItems: row.total_items,
    shippingDays: row.shipping_days,
    customerMobile: row.customer_mobile,
    adminNotes: row.admin_notes ?? undefined,
  };
}

const SELECT = `
  tracking_id, dropy_order_id, customer_name, customer_mobile, customer_city,
  items, total_weight_kg, total_items, declared_value_usd, shipping_days,
  shipping_mode, current_stage, status, progress, estimated_delivery,
  carrier_name, awb_number, admin_notes, order_date,
  dropy_order_events (stage, label, location, happened_at, note, state, sort_order)
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
