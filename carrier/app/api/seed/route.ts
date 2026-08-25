import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminIdentity } from "@/lib/admin-session";
import { logAudit } from "@/lib/audit";
import { DEMO_SHIPMENTS } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

/**
 * Once seeded into Supabase, a demo order is read back through the SAME
 * path a real order is: lib/shipment-service.ts's mapRow(), which resolves
 * route_key exclusively against lib/order-routes.ts's two real routes (see
 * getOrderRoute) — NOT against lib/routes.ts's display-only route set the
 * demo shipments' hand-authored event text was originally modeled on (see
 * the provenance note at the top of lib/demo-data.ts). Pointing a seeded
 * row's route_key at a lib/routes.ts-only key like "chicago-dubai-mumbai"
 * would silently miss in getOrderRoute() and fall back to ORDER_ROUTES[0],
 * showing the wrong location text if the live clock ever advances a seeded
 * order past its last authored event — so this maps to the real routes
 * instead, alternating so seeded data exercises both.
 */
const DEMO_ROUTE_KEYS: Record<string, string> = {
  "DRP-2026-0421": "newark-mumbai-direct",
  "DRP-2026-0388": "newyork-mumbai-direct",
  "DRP-2026-0350": "newark-mumbai-direct",
};

/**
 * POST /api/seed — seeds the database with demo DotConnects Logistics orders.
 * Safe to call repeatedly: uses upsert on tracking_id. Admin-only — this
 * writes over live order rows, and previously had no auth check at all
 * (anyone who found the route could overwrite the seeded demo orders).
 */
export async function POST() {
  try {
    // Admin only (architecture §5b). This route deletes and rebuilds event
    // trails on real order rows — it is not something daily operations
    // should be able to reach.
    const identity = await requireAdminIdentity();
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const results: string[] = [];

    for (const shipment of DEMO_SHIPMENTS) {
      const items = shipment.items ?? [];
      const orderData = {
        dropy_order_id: shipment.reference,
        tracking_id: shipment.id,
        customer_name: shipment.consignee,
        customer_mobile: shipment.customerMobile ?? "0000000000",
        customer_city: shipment.consigneeCity.split(",")[0].trim(),
        items,
        total_weight_kg: shipment.weightKg,
        total_items: shipment.totalItems ?? items.reduce((s: number, it: any) => s + (it.qty || 1), 0),
        declared_value_usd: shipment.declaredValueUsd,
        shipping_days: shipment.shippingDays ?? 10,
        shipping_mode: shipment.mode,
        current_stage: shipment.events.find(e => e.state === "current")?.stage ?? "order_placed",
        status: shipment.status,
        progress: shipment.progress,
        estimated_delivery: shipment.eta,
        carrier_name: shipment.carrier,
        awb_number: shipment.containerOrAwb !== "—" ? shipment.containerOrAwb : null,
        route_key: DEMO_ROUTE_KEYS[shipment.id],
      };

      const { data: orderRows, error: orderErr } = await supabase
        .from("dropy_orders")
        .upsert(orderData, { onConflict: "tracking_id" })
        .select("id");

      if (orderErr) {
        results.push(`✗ ${shipment.id}: ${orderErr.message}`);
        continue;
      }

      const orderId = orderRows?.[0]?.id;
      if (!orderId) { results.push(`✗ ${shipment.id}: no id returned`); continue; }

      // Clear existing events and re-insert
      const { error: delErr } = await supabase.from("dropy_order_events").delete().eq("order_id", orderId);
      if (delErr) { results.push(`✗ ${shipment.id}: clear events — ${delErr.message}`); continue; }

      const eventRows = shipment.events.map((ev, i) => ({
        order_id: orderId,
        stage: ev.stage,
        label: ev.label,
        location: ev.location,
        happened_at: ev.timestamp || "",
        note: ev.note ?? null,
        state: ev.state,
        sort_order: i,
      }));

      const { error: evErr } = await supabase.from("dropy_order_events").insert(eventRows);
      results.push(evErr ? `✗ ${shipment.id}: events — ${evErr.message}` : `✓ ${shipment.id}`);
    }

    await logAudit(identity, {
      action: "seed.run",
      note: `Reseeded ${results.length} demo order(s)`,
      after: { results },
    });

    return NextResponse.json({ seeded: results });
  } catch (err: any) {
    console.error("Uncaught POST /api/seed error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
