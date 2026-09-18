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
    .select("id, current_stage, route_key, timing_seed, items, last_mile_awb, deleted_at")
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
         it would keep the journey pinned to a moment that has been
         retracted. */
      picked_up_at: null,
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
        note: reason
          ? `Courier booking cancelled — ${reason}. Back at the Dropy India warehouse.`
          : "Courier booking cancelled. Back at the Dropy India warehouse, ready to go again.",
      })
      .eq("id", evs[0].id);
  }

  /* And a line saying where it is now. */
  const { data: qc } = await supabase
    .from("dropy_order_events")
    .select("id")
    .eq("order_id", order.id)
    .eq("stage", BACK)
    .maybeSingle();

  if (qc?.id) {
    await supabase.from("dropy_order_events")
      .update({ state: "current", happened_at: ts, location }).eq("id", qc.id);
  } else {
    await supabase.from("dropy_order_events").insert({
      order_id: order.id, stage: BACK, label: "Checked and passed",
      location, happened_at: ts, note: "Ready to ship onward.",
      state: "current", sort_order: 12,
    });
  }

  await logSystemAudit("Order Central (DOC)", {
    action: "order.handed_to_courier",
    orderId: order.id,
    before: { current_stage: "handed_to_courier", last_mile_awb: order.last_mile_awb },
    after: { current_stage: BACK, last_mile_awb: null },
    note: reason ? `India leg cancelled — ${reason}` : "India leg cancelled",
  });

  return json({ ok: true, changed: true, current_stage: BACK });
};
