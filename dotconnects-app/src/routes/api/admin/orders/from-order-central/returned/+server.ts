import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkBridgeSecret } from "$lib/server/bridge-auth";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { logSystemAudit } from "$lib/server/audit";
import { recordHoldEvent } from "$lib/server/hold-event";
import { stampFor } from "$lib/dates";
import { STAGE_PROGRESS, stageToStatus } from "$lib/admin-stages";

/**
 * The Indian courier could not deliver. The parcel is coming back.
 *
 * An RTO is the one outcome the customer's page had no way to describe.
 * The journey ends at handed_to_courier, so a returning parcel sat there
 * saying "with the courier" — true, but pointed the wrong way — with a
 * delivery date for a delivery that had already failed.
 *
 * It is NOT a fifteenth stage. Every stage is a step closer to the
 * customer, and this is a reversal: the box is going back to Vashi. So
 * it joins damaged and cancelled as a hold written into current_stage,
 * and journeyView reports it while keeping the journey pinned at the
 * handover, which is genuinely where the parcel got to.
 *
 * Only from a handover, for the same reason /unhandover only acts on
 * one: an order that never reached a courier cannot be returned by one,
 * and accepting it would invent a delivery attempt that never happened.
 *
 * Idempotent. A courier reports RTO_INITIATED, then RTO_IN_TRANSIT, then
 * RTO_DELIVERED, and DOC relays each; the second and third must not
 * rewrite the trail or move held_at.
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
    .select("id, current_stage, deleted_at")
    .eq("tracking_id", trackingId)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.deleted_at) return json({ error: "Order is deleted" }, { status: 409 });

  /* Already back. Say so and change nothing — a second webhook must not
     restamp held_at or write the trail entry twice. */
  if (order.current_stage === "returned") {
    return json({ ok: true, changed: false, current_stage: "returned" });
  }

  /* A parcel no courier ever had cannot be returned by one. */
  if (order.current_stage !== "handed_to_courier") {
    return json({ ok: true, changed: false, current_stage: order.current_stage });
  }

  const STAGE = "returned";
  const ts = stampFor();

  await supabase
    .from("dropy_orders")
    .update({
      current_stage: STAGE,
      status: stageToStatus(STAGE),
      /* The progress bar stops where the parcel got to. An RTO is not
         less done than a handover; it is done and turned around, and
         winding the bar backwards would read as a bug. */
      progress: STAGE_PROGRESS.handed_to_courier ?? 100,
      /* What makes the hold answerable later — current_stage has just
         been overwritten with the hold key, exactly as cancel and
         damaged do. */
      held_at: ts,
      /* picked_up_at is deliberately LEFT SET. The courier really did
         collect it, and clearing it would make realEventStage fall back
         to the clock on a parcel that is demonstrably past the
         warehouse. */
    })
    .eq("id", order.id);

  /* The customer's trail, not just the audit log. A parcel whose page
     said nothing new since the handover is how a failed delivery goes
     unnoticed for a week. */
  await recordHoldEvent(supabase, order.id, STAGE, order.current_stage);

  await logSystemAudit("Order Central (DOC)", {
    action: "order.returned",
    orderId: order.id,
    before: { current_stage: order.current_stage },
    after: { current_stage: STAGE },
    note: reason
      ? `Returned by the Indian courier — ${reason}`
      : "Returned by the Indian courier",
  });

  return json({ ok: true, changed: true, current_stage: STAGE });
};
