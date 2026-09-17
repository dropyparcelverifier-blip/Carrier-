import type { SupabaseClient } from "@supabase/supabase-js";
import { orderRouteStageLocation } from "$lib/order-routes";
import { resolveVendor } from "$lib/vendor-catalog";
import { stampFor } from "$lib/dates";
import { stageToStatus, STAGE_PROGRESS } from "$lib/admin-stages";
import type { LastMileCourier } from "$lib/last-mile";

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
  /* What the customer's trail says about how this handover was learned.
     A webhook confirms one that already happened; Order Central booking
     the shipment IS the handover, and the default copy — "confirmed via
     webhook, ahead of the estimated schedule" — would be untrue for it. */
  note?: string,
): Promise<boolean> {
  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, current_stage, route_key, timing_seed, items, last_mile_awb")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return false;

  /* Already handed over. Idempotent for a webhook arriving twice — but
     NOT for a different AWB, which means the shipment was cancelled and
     re-booked with another courier. Returning early there would leave
     the customer's page pointing at an AWB that no longer exists, on a
     courier that no longer has the box. Nothing else would ever correct
     it, because this is the only writer of these columns. */
  if (order.current_stage === "handed_to_courier") {
    const sameAwb = String(order.last_mile_awb ?? "") === String(awb);
    if (sameAwb) return false;

    await supabase
      .from("dropy_orders")
      .update({
        last_mile_courier: courier,
        last_mile_awb: awb,
        last_mile_tracking_url: trackingUrl ?? null,
      })
      .eq("id", order.id);

    /* The trail says so too. A customer who saw the first courier's name
       needs the line that replaces it, not a silent swap. */
    const { data: evs } = await supabase
      .from("dropy_order_events")
      .select("id")
      .eq("order_id", order.id)
      .eq("stage", "handed_to_courier");

    if (evs?.[0]?.id) {
      await supabase
        .from("dropy_order_events")
        .update({
          happened_at: stampFor(),
          carrier: courier,
          note: note ?? `Re-booked with ${courier}. Tracking continues on their page.`,
        })
        .eq("id", evs[0].id);
    }
    return true;
  }

  const ts = stampFor();
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
      // M3 task 3.13 — picked_up_at is what now DRIVES the
      // handed_to_courier stage in mapRow (architecture §7), so it must
      // be written here too. Setting current_stage alone would leave the
      // read path recomputing the stage from the clock on every request
      // and disagreeing with the column right next to it.
      picked_up_at: new Date().toISOString(),
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
  const trailNote = note
    ?? `Confirmed via ${courier} webhook — real handover, ahead of the estimated schedule.`;
  if (existing) {
    await supabase
      .from("dropy_order_events")
      .update({ state: "current", happened_at: ts, carrier: courier, note: trailNote })
      .eq("id", existing.id);
  } else {
    await supabase.from("dropy_order_events").insert({
      order_id: order.id, stage: "handed_to_courier", label: "Handed to last-mile courier",
      location, happened_at: ts, carrier: courier, note: trailNote, state: "current", sort_order: 13,
    });
  }

  return true;
}
