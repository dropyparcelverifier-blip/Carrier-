import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkBridgeSecret } from "$lib/server/bridge-auth";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { logSystemAudit } from "$lib/server/audit";
import { stampFor } from "$lib/dates";
import { STAGE_PROGRESS, stageToStatus } from "$lib/admin-stages";
import { orderRouteStageLocation } from "$lib/order-routes";
import { resolveVendor } from "$lib/vendor-catalog";

/**
 * The India leg was cancelled. The parcel is back with us.
 *
 * A booking cancelled before pickup means the box never left Vashi — or
 * came back to it. Leaving the order at handed_to_courier tells the
 * customer it is with a courier who no longer has it, on an AWB that no
 * longer exists, and nothing else would ever correct it.
 *
 * It does NOT return to the clock. The parcel is demonstrably at the
 * warehouse: a tracking number was cut, which only happens once the box
 * is in front of someone. So it lands on qc_check — arrived, checked,
 * waiting to go again — rather than resuming an estimate that would
 * place it somewhere over the Atlantic.
 *
 * Re-shipping calls /handover again, which moves it forward with the new
 * AWB.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!checkBridgeSecret(request)) return json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const trackingId = String(body.tracking_id ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  if (!trackingId) return json({ error: "tracking_id is required" }, { status: 400 });

  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, current_stage, route_key, timing_seed, items, last_mile_awb, label_generated_at, deleted_at")
    .eq("tracking_id", trackingId)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.deleted_at) return json({ error: "Order is deleted" }, { status: 409 });

  /* Only from a handover. Anything else is an order that never got
     there, and dragging it to qc_check would invent an arrival. */
  if (order.current_stage !== "handed_to_courier") {
    return json({ ok: true, changed: false, current_stage: order.current_stage });
  }

  const BACK = "qc_check";
  const items = typeof order.items === "string" ? JSON.parse(order.items) : (order.items ?? []);
  const vendor = resolveVendor(items, order.timing_seed ?? 0);
  const location = orderRouteStageLocation(order.route_key, BACK as any, vendor);
  const ts = stampFor();

  await supabase
    .from("dropy_orders")
    .update({
      current_stage: BACK,
      status: stageToStatus(BACK),
      progress: STAGE_PROGRESS[BACK] ?? 90,
      /* The handover is undone, so the pickup never happened. Left set,
         realEventStage keeps answering "handed_to_courier" and the order
         never actually comes back. */
      picked_up_at: null,
      /* But something must still hold it AT the warehouse.
      
         realEventStage reads picked_up_at, then label_generated_at, then
         gives up and lets the CLOCK decide. Clearing the pickup without
         setting this leaves both null, so a parcel two days into a
         twelve-day window is dragged back to somewhere over the
         Atlantic — the exact thing this endpoint exists to prevent.
      
         label_generated_at means qc_check reached by a real event rather
         than by elapsed time, and it is honest here: a label WAS
         generated, which is why there was an AWB to cancel. */
      label_generated_at: order.label_generated_at ?? ts,
      last_mile_courier: null,
      last_mile_awb: null,
      last_mile_tracking_url: null,
      last_mile_edd: null,
      last_mile_original_edd: null,
    })
    .eq("id", order.id);

  /* The handover event stands down rather than disappearing. It happened,
     and a customer who saw a courier's name needs the line that retracts
     it — not a silent edit of their own history. */
  const { data: evs } = await supabase
    .from("dropy_order_events")
    .select("id")
    .eq("order_id", order.id)
    .eq("stage", "handed_to_courier");

  if (evs?.[0]?.id) {
    await supabase
      .from("dropy_order_events")
      .update({
        state: "done",
        /* Pushed a second behind the qc_check the backfill draws at the
           same instant. Otherwise the retracted handover renders ABOVE
           the stage it rolled back to — "handed to courier, then checked
           and passed", which reads as the opposite of what happened. */
        happened_at: new Date(Date.parse(ts) - 1000).toISOString(),
        note: reason
          ? `Courier booking cancelled — ${reason}. Back at the Dropy India warehouse.`
          : "Courier booking cancelled. Back at the Dropy India warehouse, ready to go again.",
      })
      .eq("id", evs[0].id);
  }

  /* No qc_check event is written.
  
     Inserting one makes it `lastReal`, and the synthetic backfill only
     draws stages BETWEEN the last real event and the live stage — so a
     real qc_check row leaves nothing between, and the customer loses
     Customs cleared and At arrival warehouse from a journey they had
     already watched. Traced on a real row before this was written.
  
     current_stage plus label_generated_at is enough: the backfill
     redraws everything up to qc_check and marks it current. */

  await logSystemAudit("Order Central (DOC)", {
    action: "order.handed_to_courier",
    orderId: order.id,
    before: { current_stage: "handed_to_courier", last_mile_awb: order.last_mile_awb },
    after: { current_stage: BACK, last_mile_awb: null },
    note: reason ? `India leg cancelled — ${reason}` : "India leg cancelled",
  });

  return json({ ok: true, changed: true, current_stage: BACK });
};
