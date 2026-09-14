import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaffOrBridge } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";
import { findOrderByRef } from "$lib/server/order-ref";
import { recordHoldEvent } from "$lib/server/hold-event";

/**
 * Cancel a tracking. The PARCEL, never the order.
 *
 * Cancelling an order is an admin action taken in Shopify; a teammate
 * who spots a parcel pushed by mistake, or against the wrong US order
 * id, needs to stop that consignment without touching the sale. Until
 * now they could not: `damaged` existed and `cancelled` did not, so the
 * only way to stop a tracking was to delete the row, which took its
 * history with it.
 *
 * Like `damaged`, this is a hold state rather than a point on the route,
 * so it is written into `current_stage` as well as `status`. Everything
 * downstream already treats a non-route current_stage as "not
 * advancing", which is exactly right here: the clock stops, no further
 * stage is predicted, and the customer page ends the journey at Vashi.
 *
 * The row is kept. A tracking the customer has already seen must still
 * answer when they open it, and it has to say the parcel is not coming
 * rather than 404 as though it never existed.
 */
export const POST: RequestHandler = async ({ cookies, params, request }) => {
  /* A teammate in DOT admin, or Order Central calling in. */
  const guard = await requireStaffOrBridge(cookies, request);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim();

  /* Required. Six months on, "why is there a cancelled parcel on this
     order?" has to be answerable from the audit trail alone. */
  if (!reason) {
    return json({ error: "Say why this tracking is being cancelled." }, { status: 400 });
  }

  /* By row id from the admin panel, or by tracking id from DOC —
     which never learns the row id. */
  const order = await findOrderByRef(supabase, params.id, "id, tracking_id, dropy_order_id, current_stage, status, delivered_at, deleted_at");

  if (!order || order.deleted_at) {
    return json({ error: "Order not found." }, { status: 404 });
  }
  if (order.current_stage === "cancelled") {
    return json({ error: "This tracking is already cancelled." }, { status: 409 });
  }
  /* A delivered parcel is at the customer's door. Whatever happened
     after that is a return, not a cancellation, and calling it one would
     put a "not coming" page in front of someone holding the box. */
  if (order.delivered_at) {
    return json({ error: "This parcel was delivered — cancelling it would be untrue." }, { status: 409 });
  }

  const { error } = await supabase
    .from("dropy_orders")
    .update({ current_stage: "cancelled", status: "Cancelled" })
    .eq("id", order.id);

  if (error) return json({ error: error.message }, { status: 500 });

  /* The audit log is for staff. This is the trail the customer reads. */
  await recordHoldEvent(supabase, order.id, "cancelled", order.current_stage);

  await logAudit(identity, {
    action: "order.cancel",
    orderId: order.id,
    before: { current_stage: order.current_stage, status: order.status },
    after: { current_stage: "cancelled", status: "Cancelled" },
    note: reason,
  });

  return json({ ok: true, tracking_id: order.tracking_id, current_stage: "cancelled" });
};
