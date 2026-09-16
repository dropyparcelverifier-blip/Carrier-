import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkBridgeSecret } from "$lib/server/bridge-auth";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { logSystemAudit } from "$lib/server/audit";
import { advanceToHandedToCourier } from "$lib/server/advance-to-courier";
import { LAST_MILE_COURIERS, type LastMileCourier } from "$lib/last-mile";

/**
 * Order Central has booked the India leg. This app's journey is over.
 *
 * DotConnects carries the parcel from the US to Vashi and stops there —
 * the last mile belongs to Shiprocket or Velocity, and once one of them
 * has the box, the real remaining tracking lives on their page. The
 * customer keeps the same link; it stops counting and shows the courier's
 * instead.
 *
 * Until now the only way to reach handed_to_courier was a courier webhook
 * happening to arrive, which meant the stage confirmed a handover rather
 * than recording one. Order Central books the shipment, so it knows
 * first and it knows for certain.
 *
 * Idempotent: advanceToHandedToCourier no-ops on an order already there,
 * so a retried or duplicated call changes nothing. That matters because
 * Order Central calls this AFTER it has already written the AWB to its
 * own record — if this fails it will be retried, and a second call must
 * not rewrite the trail.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!checkBridgeSecret(request)) return json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const trackingId = String(body.tracking_id ?? "").trim();
  const awb = String(body.awb ?? "").trim();
  const rawCourier = String(body.courier ?? "").trim();
  const trackingUrl = String(body.tracking_url ?? "").trim() || null;

  if (!trackingId) return json({ error: "tracking_id is required" }, { status: 400 });
  if (!awb) return json({ error: "awb is required" }, { status: 400 });

  /* Order Central sends the CARRIER name — "DTDC Surface", "Amazon
     Transportation" — while this column holds the PLATFORM it was booked
     through. They are different things and the deep links in
     lib/last-mile.ts are per platform, so a carrier name stored here
     produces a tracking URL that goes nowhere. */
  const courier: LastMileCourier | null =
    LAST_MILE_COURIERS.find((c) => c.toLowerCase() === rawCourier.toLowerCase())
    ?? (/velocity/i.test(rawCourier) ? "Velocity"
      : /shiprocket/i.test(rawCourier) ? "Shiprocket"
      : null);

  if (!courier) {
    return json({
      error: `courier must be Shiprocket or Velocity — got "${rawCourier}"`,
    }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, current_stage, deleted_at")
    .eq("tracking_id", trackingId)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.deleted_at) return json({ error: "Order is deleted" }, { status: 409 });

  const advanced = await advanceToHandedToCourier(
    supabase, order.id, courier, awb, trackingUrl,
    `Handed to ${courier} for the final leg. Tracking continues on their page.`,
  );

  await logSystemAudit("Order Central (DOC)", {
    action: "order.handed_to_courier",
    orderId: order.id,
    before: { current_stage: order.current_stage },
    after: { current_stage: "handed_to_courier", last_mile_courier: courier, last_mile_awb: awb },
    note: advanced
      ? `Booked via ${courier} · AWB ${awb}`
      : `Already handed over — no change (AWB ${awb})`,
  });

  /* ok either way. "Already there" is success from Order Central's point
     of view: the thing it wanted true is true. Returning an error would
     make it retry something that has already happened. */
  return json({ ok: true, advanced, current_stage: "handed_to_courier", courier, awb });
};
