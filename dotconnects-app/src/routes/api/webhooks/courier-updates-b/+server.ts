import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { advanceToHandedToCourier } from "$lib/server/advance-to-courier";
import { logSystemAudit } from "$lib/server/audit";
import { env } from "$env/dynamic/private";

/**
 * Velocity webhook — now parsed, not just captured.
 *
 * Built from Velocity's published API docs (velocity.in/shipping-faq/api),
 * not from a guessed shape. Their documented payload:
 *
 *   {
 *     "event": "status_change",
 *     "event_id": "fe629ee4-…",
 *     "event_timestamp": "2026-04-15T10:58:47+05:30",
 *     "data": {
 *       "shipment_id": "SHIQ6MAKJMOIY",
 *       "tracking_number": "41332221429154",   <- the AWB
 *       "order_id": "ORDQ7LAKF9XJJ",           <- THEIR id, not ours
 *       "order_external_id": "…",              <- OURS
 *       "order_display_id": "…",
 *       "status": "delivered",
 *       "sub_status": "delivered",
 *       "carrier_name": "Delhivery Standard",
 *       "shipment_type": "forward",
 *       "tracking_url": "https://www.velocityshipping.in/track/…"
 *     }
 *   }
 *
 * Auth is the X-API-Key header, per their docs.
 *
 * WHY THIS MATTERED: until now this route captured and stopped, so an
 * order shipped through Velocity never got label_generated_at or
 * picked_up_at. The clock ran out, the customer page said "running late",
 * and it stayed there while the parcel was actually delivered. Every
 * Velocity shipment did this.
 */

/**
 * Statuses meaning THE COURIER HAS IT — this app's leg is done.
 *
 * Same rule as Shiprocket: a courier record forwards the order,
 * regardless of whether the van has physically arrived yet.
 *
 * Deliberately excluded, because no courier holds the parcel:
 *   pending    created but not yet assigned to a courier
 *   rejected   cancelled before courier assignment
 *   processing intermediate system state
 *   cancelled  cancelled outright
 */
const FORWARDED_STATUSES = new Set([
  "ready_for_pickup", "pickup_scheduled", "not_picked",
  "in_transit", "out_for_delivery", "delivered",
  "ndr_raised", "need_attention", "reattempt_delivery",
  "lost", "externally_fulfilled",
  // RTO means it reached the consignee's area and is coming back. The
  // forward leg demonstrably completed, so it still counts as forwarded.
  // A dedicated RTO state on the customer page is a separate piece of
  // work — see the stages proposal.
  "rto_initiated", "rto_in_transit", "rto_delivered", "rto_need_attention", "rto_lost",
]);

/**
 * Statuses worth logging to the admin trail once an order is already
 * forwarded, but which must never forward one on their own.
 *
 * "cancelled" on a live order is something the team needs to see. On an
 * order we never handed over it means nothing happened at all.
 */
const POST_HANDOVER_ONLY = new Set([
  "cancelled", "rejected",
  "return_rejected", "return_pickup_scheduled", "return_not_picked",
  "return_in_transit", "return_delivered", "return_cancelled",
  "return_ndr_raised", "return_need_attention", "return_qc_failed", "return_lost",
]);

export const POST: RequestHandler = async ({ request }) => {
  const expected = env.VELOCITY_WEBHOOK_SECRET;
  const headers = Object.fromEntries(request.headers);

  // Capture FIRST, and capture even when auth fails — an unauthenticated
  // hit is exactly the evidence needed to work out what they actually
  // send. Acting on it is a different matter; see below.
  const raw = await request.text();
  let payload: any = null;
  try { payload = JSON.parse(raw); } catch { /* keep raw */ }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("captured_velocity_webhooks").insert({
      payload: payload ?? { raw },
      headers,
    });
  }

  // Velocity documents X-API-Key. The other two are kept as fallbacks
  // because the captured evidence, not the docs, is what will settle it
  // if they ever differ.
  if (expected) {
    const provided =
      request.headers.get("x-api-key") ??
      request.headers.get("x-webhook-secret") ??
      request.headers.get("authorization") ?? "";
    if (!provided.includes(expected)) {
      // Captured, but NOT acted on. An unauthenticated request must
      // never move an order.
      return json({ ok: true, captured: true, authenticated: false });
    }
  }

  if (!supabase) return json({ ok: true, captured: false, error: "Supabase not configured" }, { status: 503 });
  if (!payload) return json({ ok: true, captured: true, parsed: false });

  const d = payload.data ?? {};
  const status = String(d.status ?? "").toLowerCase().trim();
  /**
   * shipment_type is documented but ABSENT from real payloads.
   *
   * Defaulting to "forward" is deliberate, not an accident of the ??
   * operator: a forward event is by far the common case, and the return
   * and RTO statuses are excluded from FORWARDED_STATUSES anyway — so a
   * mislabelled return can still only reach the logging path, never the
   * forwarding one.
   */
  const shipmentType = String(d.shipment_type ?? "forward").toLowerCase().trim();
  const awb = String(d.tracking_number ?? "").trim();
  const trackingUrl = String(d.tracking_url ?? "").trim() || null;
  const eventId = String(payload.event_id ?? "").trim();
  // Docs say "status_change"; the real payload said "tracking_addition".
  // Not gated on — the status field is what matters — but worth logging
  // so a new event type is visible rather than silent.
  const eventType = String(payload.event ?? "").trim();

  const canForward = shipmentType === "forward" && FORWARDED_STATUSES.has(status);
  const worthLogging = canForward || POST_HANDOVER_ONLY.has(status) || shipmentType !== "forward";

  if (!worthLogging) {
    return json({ ok: true, parsed: true, action: "ignored", status, event: eventType });
  }

  // Idempotency on event_id, as their docs recommend. Retries and
  // duplicate deliveries are normal; the count is 2 because this
  // request's own capture row is already in the table.
  if (eventId) {
    const { count } = await supabase
      .from("captured_velocity_webhooks")
      .select("id", { count: "exact", head: true })
      .eq("payload->>event_id", eventId);
    if ((count ?? 0) > 1) {
      return json({ ok: true, parsed: true, action: "duplicate event" });
    }
  }

  /**
   * Which field actually identifies OUR order.
   *
   * The docs implied order_external_id was our reference. A real captured
   * payload says otherwise:
   *
   *   order_id           "ORDOOZZYORO00"    Velocity's own
   *   order_external_id  "5931361599568"    SHOPIFY's order id
   *   order_display_id   "#Dropy-1855"      ours — with a leading #
   *
   * So order_display_id is the only usable match, and it arrives with a
   * "#" that the database column does not have. Without stripping it the
   * filter reads `dropy_order_id.eq.#Dropy-1855`, matches nothing, and
   * every Velocity webhook silently finds no order.
   *
   * external_id is still tried: if the Shopify order id is ever stored
   * against a consignment it becomes a valid second route in.
   */
  const ourRefs = [d.order_display_id, d.order_external_id]
    .map((v: unknown) => String(v ?? "").trim().replace(/^#/, ""))
    .filter(Boolean);

  const filters = [
    ...ourRefs.flatMap((r) => [`dropy_order_id.eq.${r}`, `tracking_id.eq.${r}`]),
    ...(awb ? [`last_mile_awb.eq.${awb}`] : []),
  ];
  if (filters.length === 0) {
    return json({ ok: true, parsed: true, action: "no usable reference" });
  }

  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, tracking_id, current_stage, picked_up_at")
    .or(filters.join(","))
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) return json({ ok: true, parsed: true, action: "no matching order" });

  // ── Already forwarded: log, don't re-forward ──
  //
  // Everything after the handover — picked up, not picked, in transit,
  // delivered — belongs in the ADMIN trail, not on the customer page.
  // The customer's journey ends at "Forwarded to courier"; from there
  // they follow the courier's own tracking.
  //
  // These used to be dropped silently, so the team had no way to see
  // that a pickup had failed without opening Velocity.
  if (order.picked_up_at || !canForward) {
    // Either already handed over, or a status that must never forward on
    // its own (a return leg, a cancellation). Either way: admin trail.
    await logSystemAudit("Velocity webhook", {
      action: "order.update",
      orderId: order.id,
      after: { courier_status: status, sub_status: d.sub_status ?? null },
      // new_tracking.location is Velocity's own coded hub name —
      // "Mumbai_ShastriNagar_D (Maharashtra)". Undocumented, but it's the
      // most useful thing in the payload for anyone chasing a parcel.
      note: `Velocity: ${status}${d.carrier_name ? ` — ${d.carrier_name}` : ""}${d.new_tracking?.location ? ` @ ${d.new_tracking.location}` : ""}`,
    });
    return json({ ok: true, parsed: true, action: "logged post-handover", status });
  }

  // Velocity gives us a real tracking URL — better than reconstructing
  // one from the AWB.
  await advanceToHandedToCourier(supabase, order.id, "Velocity", awb, trackingUrl);

  await logSystemAudit("Velocity webhook", {
    action: "order.stage_change",
    orderId: order.id,
    before: { current_stage: order.current_stage },
    after: { current_stage: "handed_to_courier", last_mile_awb: awb },
    note: `Velocity reported "${status}"${d.carrier_name ? ` via ${d.carrier_name}` : ""} — AWB ${awb}`,
  });

  return json({ ok: true, parsed: true, action: "advanced" });
};
