import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkBridgeSecret } from "$lib/server/bridge-auth";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { logSystemAudit } from "$lib/server/audit";
import { pauseOrder, resumeOrder } from "$lib/order-status";

/**
 * Pause or resume a parcel's clock. DOC-driven.
 *
 * "exception" is a PAUSE, not a position on the timeline -- the parcel
 * stops where it is and the clock stops with it, so the hold shows up as
 * real days on the customer's date instead of being absorbed while the
 * schedule runs on underneath.
 *
 * Same writer as the staff endpoint, deliberately: these were two inline
 * copies of the same update and they had already drifted.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!checkBridgeSecret(request)) return json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const trackingId = String(body.tracking_id ?? "").trim();
  const clearing = body.clear === true;
  const reason = String(body.reason ?? "").trim();

  if (!trackingId) return json({ error: "tracking_id is required" }, { status: 400 });
  if (!clearing && !reason) {
    return json({ error: "A reason is required to pause a parcel." }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, tracking_id, current_stage, deleted_at, delay_total_ms")
    .eq("tracking_id", trackingId)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.deleted_at) return json({ error: "Order is deleted" }, { status: 409 });

  if (clearing) {
    const result = await resumeOrder(supabase, order.id);
    if ("error" in result) return json({ error: result.error }, { status: 409 });

    await logSystemAudit("Order Central (DOC)", {
      action: "order.clear_delay",
      orderId: order.id,
      before: { current_stage: order.current_stage, delay_total_ms: order.delay_total_ms ?? 0 },
      after: { current_stage: result.current_stage, delay_total_ms: result.delay_total_ms },
      note: `Resumed by Order Central after ${Math.round(result.paused_ms / 3_600_000)}h`
        + ` — delivery now ${result.estimated_delivery}`,
    });

    return json({
      ok: true,
      current_stage: result.current_stage,
      paused_ms: result.paused_ms,
      delay_total_ms: result.delay_total_ms,
      estimated_delivery: result.estimated_delivery,
    });
  }

  const result = await pauseOrder(supabase, order.id, { reason });
  if ("error" in result) return json({ error: result.error }, { status: 409 });

  await logSystemAudit("Order Central (DOC)", {
    action: "order.mark_delayed",
    orderId: order.id,
    before: { current_stage: result.prior_stage },
    after: { current_stage: "exception", delayed_at: result.delayed_at },
    note: reason || "Paused by Order Central",
  });

  return json({ ok: true, current_stage: "exception", delayed_at: result.delayed_at });
};
