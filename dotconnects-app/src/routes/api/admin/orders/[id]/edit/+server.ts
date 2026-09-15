import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaffOrBridge } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";
import { findOrderByRef } from "$lib/server/order-ref";
import { journeyView } from "$lib/journey";
import { STAGES } from "$lib/types";

/**
 * Correct a consignment that was built wrong.
 *
 * Not a journey event — nothing happened to the parcel. Somebody put the
 * wrong items on it, or typed the wrong Amazon order, and the record has
 * to match the box before the box leaves.
 *
 * WHAT THIS DELIBERATELY DOES NOT TOUCH
 *
 *   tracking_id        The customer already has it. It embeds the last
 *                      seven digits of the US order id, but nothing ever
 *                      reads them back — write-only provenance. Killing
 *                      a live link to correct a number the customer
 *                      never sees is a bad trade.
 *   route_key,
 *   timing_seed,
 *   order_date,
 *   shipping_days,
 *   estimated_delivery,
 *   doorstep_days      All fixed at push time from the ORDER'S WINDOW,
 *                      not from what is inside the box. Recomputing them
 *                      would move a customer's arrival date because a
 *                      teammate fixed their own typo.
 *   current_stage      The clock is unaffected. The parcel is where it
 *                      was.
 *
 * So the blast radius is the contents and the vendor reference: items,
 * weight, declared value, us_order_id. Nothing customer-facing moves.
 *
 * NO CUSTOMER EVENT is written. The item count on the tracking page
 * changes silently, which is correct — "we changed what is in your
 * parcel" invites a question nobody wants to answer, and the change is
 * an internal correction rather than something that befell the shipment.
 * The audit log carries who, when and why.
 */

/* The box is with the carrier from `dispatched` onward. After that,
   what is in it is what is in it, and editing the record only makes the
   two apps disagree with reality rather than with each other. */
const LAST_EDITABLE = "packed";

export const POST: RequestHandler = async ({ cookies, params, request }: any) => {
  const guard = await requireStaffOrBridge(cookies, request);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim();

  /* Required, and the whole point of the feature's existence. Every edit
     is somebody correcting a mistake; if these start arriving weekly the
     split-building step needs fixing, and without a logged reason there
     is nothing to count. */
  if (!reason) {
    return json({ error: "Say why this consignment is being corrected." }, { status: 400 });
  }

  /* The columns the guards and the patch need, and no more. */
  const order = await findOrderByRef(
    supabase, params.id,
    "id, tracking_id, us_order_id, current_stage, route_key, order_date, " +
    "shipping_days, timing_seed, held_at, delayed_at, delay_total_ms, " +
    "total_items, total_weight_kg, " +
    "declared_value_usd, deleted_at",
  );
  if (!order) return json({ error: "Order not found." }, { status: 404 });
  if (order.deleted_at) return json({ error: "Order is deleted." }, { status: 409 });

  /* Hold states are not editable either. A damaged parcel's contents are
     the contents it was damaged with, and a cancelled one is still
     flying to Vashi with whatever is in it. */
  const view = journeyView(order);
  /* `paused` is listed explicitly rather than inherited: `exception` used
     to be frozen, so this guard already refused a delayed parcel, and
     splitting the two states must not quietly make one editable. */
  if (view.frozen || view.capped || view.paused) {
    return json({
      error: `This consignment is ${order.current_stage} and cannot be edited.`,
    }, { status: 409 });
  }

  const idx = (k: string) => STAGES.findIndex((s) => s.key === k);
  if (idx(view.journey) > idx(LAST_EDITABLE)) {
    return json({
      error: `Too late to edit — this parcel reached "${view.journey}". ` +
             `What is in the box is what is in the box.`,
    }, { status: 409 });
  }

  /* An empty consignment is a tracking with no parcel under it, and the
     customer already holds that link. Emptying one is a cancellation and
     belongs to the cancel endpoint, where it says so to the customer. */
  const items = Array.isArray(body.items) ? body.items : null;
  if (!items || !items.length) {
    return json({
      error: "A consignment cannot be emptied here — cancel the tracking instead.",
    }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    items: JSON.stringify(items),
    total_items: Number(body.total_items ?? items.length),
  };

  /* D15. Ignoring a zero was meant to stop a bad number clobbering a good
     one. It does the opposite after an edit: move the only weighed item
     off a consignment and the old weight survives, now describing
     contents that have left. DOT ends up certain a rabbit hutch weighs
     what the parrot food did.

     So there are three cases, and the caller says which:
       a number   — use it
       null       — "I could not weigh these", store null, better an
                    honest blank than a confident wrong figure
       absent     — not part of this edit, leave the column alone */
  if ("total_weight_kg" in body) {
    const weight = Number(body.total_weight_kg);
    patch.total_weight_kg =
      body.total_weight_kg === null || !Number.isFinite(weight) || weight <= 0
        ? null
        : weight;
  }

  /* Value is different: every item carries a price, so a zero here means
     zero, not unknown. Left as-is deliberately. */
  const value = Number(body.declared_value_usd);
  if (Number.isFinite(value) && value >= 0) patch.declared_value_usd = value;

  /* Changing the vendor reference is the other half of "built wrong".
     The tracking id keeps its original digits and that is fine — see the
     note above. What is NOT fine is two live consignments claiming the
     same Amazon order, so that is refused. */
  const newUsId = String(body.us_order_id ?? "").trim();
  if (newUsId && newUsId !== order.us_order_id) {
    const { data: clash } = await supabase
      .from("dropy_orders")
      .select("tracking_id")
      .eq("us_order_id", newUsId)
      .is("deleted_at", null)
      .neq("id", order.id)
      .maybeSingle();
    if (clash) {
      return json({
        error: `US order ${newUsId} is already on ${clash.tracking_id}.`,
      }, { status: 409 });
    }
    patch.us_order_id = newUsId;
  }

  const { error } = await supabase
    .from("dropy_orders").update(patch).eq("id", order.id);
  if (error) return json({ error: error.message }, { status: 500 });

  /* before/after, not a freeform blob — it is what every other action in
     this log uses, so a consignment edit reads the same way as a stage
     change when somebody is scrolling the trail six months from now. */
  await logAudit(identity, {
    action: "order.update",
    orderId: order.id,
    note: `Consignment corrected — ${reason}`,
    before: {
      total_items: order.total_items,
      total_weight_kg: order.total_weight_kg,
      declared_value_usd: order.declared_value_usd,
      us_order_id: order.us_order_id,
    },
    after: {
      total_items: patch.total_items,
      total_weight_kg: patch.total_weight_kg ?? order.total_weight_kg,
      declared_value_usd: patch.declared_value_usd ?? order.declared_value_usd,
      us_order_id: patch.us_order_id ?? order.us_order_id,
      /* Recorded so the staleness is ON the record rather than a
         surprise later: once us_order_id changes, the tracking id's
         trailing digits no longer match the order they were minted
         from. Nothing reads them, but somebody will eventually notice
         and wonder. */
      tracking_id: order.tracking_id,
      tracking_digits_now_stale: Boolean(patch.us_order_id),
    },
  });

  return json({
    ok: true,
    tracking_id: order.tracking_id,
    total_items: patch.total_items,
    total_weight_kg: patch.total_weight_kg ?? order.total_weight_kg,
    declared_value_usd: patch.declared_value_usd ?? order.declared_value_usd,
    us_order_id: patch.us_order_id ?? order.us_order_id,
  });
};
