import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-session";
import { DEMO_SHIPMENTS } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

/**
 * POST /api/seed — seeds the database with demo Dropy orders.
 * Safe to call repeatedly: uses upsert on tracking_id. Admin-only — this
 * writes over live order rows, and previously had no auth check at all
 * (anyone who found the route could overwrite the seeded demo orders).
 */
export async function POST() {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    await supabase.from("dropy_order_events").delete().eq("order_id", orderId);

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

  return NextResponse.json({ seeded: results });
}
