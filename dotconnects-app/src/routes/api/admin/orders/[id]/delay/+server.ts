import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaffOrBridge } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";
import { suggestStageForOrderRoute } from "$lib/order-routes";

/**
 * Flag an order as stuck, and clear the flag when it moves again.
 *
 * `exception` is not a point on the route -- it says the parcel has
 * stopped somewhere it should not have. The customer page reads it as
 * held rather than as progress, which is the difference between an
 * honest "this is stuck" and a timeline quietly ticking past dates
 * nothing is happening on.
 *
 * The bridge has a delay endpoint already, authenticated with the bridge
 * secret and called by nothing. This is the same operation behind a
 * staff session, plus the undo the bridge version never had: a
 * mis-clicked exception was otherwise only reversible with raw SQL.
 */
export const POST: RequestHandler = async ({ cookies, params, request }) => {
  /* A teammate in DOT admin, or Order Central calling in. */
  const guard = await requireStaffOrBridge(cookies, request);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));
  const clearing = body.clear === true;
  const reason = String(body.reason ?? "").trim();

  /* A reason is required to flag, not to clear. Someone reading this
     order in a month needs to know what was wrong; clearing it is
     self-explanatory because the parcel moved. */
  if (!clearing && !reason) {
    return json({ error: "Say what the hold-up is." }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, tracking_id, current_stage, status, deleted_at, order_date, shipping_days, route_key, timing_seed")
    .eq("id", params.id)
    .maybeSingle();

  if (!order || order.deleted_at) {
    return json({ error: "Order not found." }, { status: 404 });
  }

  if (clearing && order.current_stage !== "exception") {
    return json({ error: "This order isn't flagged as delayed." }, { status: 409 });
  }
  if (!clearing && order.current_stage === "exception") {
    return json({ error: "Already flagged as delayed." }, { status: 409 });
  }

  /* Clearing returns the parcel to where the CLOCK says it should be by
     now, not to whatever stage it sat at before the hold. A parcel held
     a week has moved on in the schedule while it waited, and putting it
     back would replay stages the customer has already seen. The route's
     own suggestion is used rather than a hard-coded key -- the stage
     list differs by route, and "in_customs" is not even one of them. */
  const next = clearing
    ? suggestStageForOrderRoute(order.route_key, order.order_date,
        order.shipping_days ?? 12, order.timing_seed ?? 0)
    : "exception";
  const nextStatus = clearing ? "In Transit" : "Customs Clearance";

  const { error } = await supabase
    .from("dropy_orders")
    .update({ current_stage: next, status: nextStatus })
    .eq("id", order.id);

  if (error) return json({ error: error.message }, { status: 500 });

  await logAudit(identity, {
    action: clearing ? "order.clear_delay" : "order.mark_delayed",
    orderId: params.id,
    before: { current_stage: order.current_stage, status: order.status },
    after: { current_stage: next, status: nextStatus },
    note: clearing ? "Hold cleared — parcel moving again" : reason,
  });

  return json({ ok: true, current_stage: next });
};
