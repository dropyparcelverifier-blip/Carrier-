import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaffOrBridge } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";
import { findOrderByRef } from "$lib/server/order-ref";
import { pauseOrder, resumeOrder } from "$lib/order-status";

/**
 * Pause a parcel's clock, and resume it when the parcel moves again.
 *
 * `exception` is not a point on the route -- it says the parcel has
 * stopped somewhere it should not have. The clock stops with it, so the
 * hold costs the customer real days on the date rather than being
 * absorbed silently while the schedule ticks on underneath.
 *
 * Both the arithmetic and the customer's trail entry live in
 * lib/order-status.ts, shared with the bridge endpoint. They were two
 * inline copies that had already drifted: one wrote a status the other
 * didn't, and neither wrote anything the customer could see.
 */
export const POST: RequestHandler = async ({ cookies, params, request }) => {
  /* A teammate in DOT admin, or Order Central calling in. */
  const guard = await requireStaffOrBridge(cookies, request);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));
  const clearing = body.clear === true;
  const reason = String(body.reason ?? "").trim();

  /* A reason is required to pause, not to resume. Someone reading this
     order in a month needs to know what was wrong; resuming is
     self-explanatory because the parcel moved. */
  if (!clearing && !reason) {
    return json({ error: "Say what the hold-up is." }, { status: 400 });
  }

  /* By row id from the admin panel, or by tracking id from DOC --
     which never learns the row id. */
  const order = await findOrderByRef(
    supabase, params.id,
    "id, tracking_id, current_stage, status, deleted_at, delayed_at, delay_total_ms",
  );

  if (!order || order.deleted_at) {
    return json({ error: "Order not found." }, { status: 404 });
  }

  if (clearing) {
    const result = await resumeOrder(supabase, order.id);
    if ("error" in result) return json({ error: result.error }, { status: 409 });

    await logAudit(identity, {
      action: "order.clear_delay",
      orderId: order.id,
      before: { current_stage: order.current_stage, delay_total_ms: order.delay_total_ms ?? 0 },
      after: { current_stage: result.current_stage, delay_total_ms: result.delay_total_ms },
      note: `Resumed after ${Math.round(result.paused_ms / 3_600_000)}h paused`
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

  /* The full reason, including anything typed freehand, lands HERE and
     only here. The customer's trail gets one fixed line. */
  await logAudit(identity, {
    action: "order.mark_delayed",
    orderId: order.id,
    before: { current_stage: result.prior_stage },
    after: { current_stage: "exception", delayed_at: result.delayed_at },
    note: reason,
  });

  return json({ ok: true, current_stage: "exception", delayed_at: result.delayed_at });
};
