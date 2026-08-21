import type { SupabaseClient } from "@supabase/supabase-js";
import { orderRouteStageLocation } from "@/lib/order-routes";
import { resolveVendor } from "@/lib/vendor-catalog";
import { nowIST } from "@/lib/dates";
import { stageToStatus, STAGE_PROGRESS } from "@/lib/admin-stages";
import type { LastMileCourier } from "@/lib/last-mile";

/**
 * Advances an order to handed_to_courier from a REAL courier webhook,
 * for the case where the physical handover genuinely happened earlier
 * than this app's clock-based estimate would have shown it (e.g. still
 * sitting at at_vashi_warehouse/qc_check while Shiprocket/Velocity
 * already has the shipment) — see the webhook routes' own notes on why
 * this exists. This is the ONE exception to "webhooks only log, never
 * mutate state" (see courier-updates-a/b's own scope notes): confirming
 * the handover itself, which is this app's real terminal tracked stage.
 * Everything the courier reports AFTER handover still only gets logged,
 * never mutates state further — this function only ever sets
 * handed_to_courier, nothing past it.
 *
 * No-ops (returns false) if the order is already at handed_to_courier —
 * idempotent against duplicate/retried webhook deliveries, and never
 * regresses an order that's already further along.
 */
export async function advanceToHandedToCourier(
  supabase: SupabaseClient,
  orderId: string,
  courier: LastMileCourier,
  awb: string,
  trackingUrl: string | null,
): Promise<boolean> {
  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, current_stage, route_key, timing_seed, items")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.current_stage === "handed_to_courier") return false;

  const ts = nowIST();
  const { error: updErr } = await supabase
    .from("dropy_orders")
    .update({
      current_stage: "handed_to_courier",
      status: stageToStatus("handed_to_courier"),
      progress: STAGE_PROGRESS.handed_to_courier,
      last_mile_courier: courier,
      last_mile_awb: awb,
      ...(trackingUrl ? { last_mile_tracking_url: trackingUrl } : {}),
      actual_delivery: new Date().toISOString(),
    })
    .eq("id", order.id);
  if (updErr) {
    console.error("advanceToHandedToCourier: failed to update order", updErr);
    return false;
  }

  const items = typeof order.items === "string" ? JSON.parse(order.items) : (order.items ?? []);
  const vendor = resolveVendor(items, order.timing_seed ?? 0);

  const { data: events } = await supabase.from("dropy_order_events").select("*").eq("order_id", order.id);
  for (const ev of events ?? []) {
    if (ev.stage !== "handed_to_courier" && ev.state !== "done") {
      await supabase.from("dropy_order_events").update({ state: "done" }).eq("id", ev.id);
    }
  }

  const existing = (events ?? []).find((ev) => ev.stage === "handed_to_courier");
  const location = orderRouteStageLocation(order.route_key, "handed_to_courier", vendor);
  const note = `Confirmed via ${courier} webhook — real handover, ahead of the estimated schedule.`;
  if (existing) {
    await supabase
      .from("dropy_order_events")
      .update({ state: "current", happened_at: ts, carrier: courier, note })
      .eq("id", existing.id);
  } else {
    await supabase.from("dropy_order_events").insert({
      order_id: order.id, stage: "handed_to_courier", label: "Handed to last-mile courier",
      location, happened_at: ts, carrier: courier, note, state: "current", sort_order: 13,
    });
  }

  return true;
}
