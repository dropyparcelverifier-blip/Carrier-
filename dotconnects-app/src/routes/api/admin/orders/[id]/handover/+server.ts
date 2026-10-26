import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff } from "$lib/server/guards";
import { outOfScope, isDropyOrder } from "$lib/server/brand-scope";
import { findOrderByRef } from "$lib/server/order-ref";
import { advanceToHandedToCourier } from "$lib/server/advance-to-courier";
import { logAudit } from "$lib/server/audit";
import { LAST_MILE_COURIERS, type LastMileCourier } from "$lib/last-mile";
import { checkTrackingUrl } from "$lib/server/tracking-url";

/**
 * "Shipped in India" — a brand admin records the Indian courier booking.
 *
 * The brand books its own parcel in its own Velocity / Shiprocket panel
 * and pastes the result here. Same effect as Order Central's /handover:
 * the journey moves to handed_to_courier and the customer's /c/ link
 * starts opening the courier's page. Saving again with a different AWB
 * replaces it (advanceToHandedToCourier handles a re-booking).
 *
 * BRAND ORDERS ONLY. A Dropy order's India leg is booked by DOC, which
 * calls the bridge /handover — a second writer here would let the two
 * disagree about which AWB the customer is shown.
 */

export const POST: RequestHandler = async ({ cookies, params, request }) => {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard.response;
  const scoped = await outOfScope(guard, params.id);
  if (scoped) return scoped;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));
  const rawCourier = String(body.courier ?? "").trim();
  const courier = LAST_MILE_COURIERS.find((c) => c.toLowerCase() === rawCourier.toLowerCase()) as LastMileCourier | undefined;
  if (!courier) return json({ error: "Pick Velocity or Shiprocket." }, { status: 400 });

  const awb = String(body.awb ?? "").trim();
  if (!/^[A-Za-z0-9-]{4,40}$/.test(awb)) {
    return json({ error: "Enter the AWB (letters and digits, 4–40)." }, { status: 400 });
  }

  const link = checkTrackingUrl(body.tracking_url);
  if (!link.url) return json({ error: link.error }, { status: 400 });

  let edd: string | null = null;
  if (body.edd) {
    const ms = Date.parse(String(body.edd));
    if (!Number.isFinite(ms)) return json({ error: "Expected delivery isn't a date." }, { status: 400 });
    edd = new Date(ms).toISOString();
  }

  const order = await findOrderByRef(supabase, params.id, "*");
  if (!order || order.deleted_at) return json({ error: "Order not found." }, { status: 404 });
  if (isDropyOrder(order)) {
    return json({ error: "Dropy orders are shipped in India from Order Central (DOC)." }, { status: 409 });
  }
  if (["cancelled", "damaged"].includes(order.current_stage)) {
    return json({ error: `This tracking is ${order.current_stage} — it can't be handed to a courier.` }, { status: 409 });
  }

  const before = {
    current_stage: order.current_stage,
    last_mile_courier: order.last_mile_courier ?? null,
    last_mile_awb: order.last_mile_awb ?? null,
    last_mile_tracking_url: order.last_mile_tracking_url ?? null,
  };

  const advanced = await advanceToHandedToCourier(
    supabase, order.id, courier, awb, link.url,
    `Handed to ${courier} for the final leg. Tracking continues on their page.`,
  );

  /* advanceToHandedToCourier no-ops on the same AWB. The link may still
     have been corrected (pasted wrong the first time), and the EDD is
     its own field, so both are written either way. */
  const patch: Record<string, unknown> = { last_mile_tracking_url: link.url };
  if (edd) {
    patch.last_mile_edd = edd;
    if (!order.last_mile_original_edd) patch.last_mile_original_edd = edd;
  }
  const { error } = await supabase.from("dropy_orders").update(patch).eq("id", order.id);
  if (error) return json({ error: error.message }, { status: 500 });

  await logAudit(identity, {
    action: "order.handed_to_courier",
    orderId: order.id,
    before,
    after: { current_stage: "handed_to_courier", last_mile_courier: courier, last_mile_awb: awb, last_mile_tracking_url: link.url },
    note: `Shipped in India via ${courier} · AWB ${awb}`,
  });

  return json({ ok: true, advanced, courier, awb, tracking_url: link.url, warning: link.warning ?? null });
};
