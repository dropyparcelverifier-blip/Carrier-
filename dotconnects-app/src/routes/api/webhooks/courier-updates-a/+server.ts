import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { advanceToHandedToCourier } from "$lib/server/advance-to-courier";
import { logSystemAudit } from "$lib/server/audit";
import { env } from "$env/dynamic/private";
import { timingSafeEqual } from "node:crypto";

/**
 * Shiprocket webhook. Payload format confirmed from a real capture.
 *
 * Everything is stored raw first, before any parsing — a payload we
 * failed to understand is still evidence, and the one we most need to
 * see is the one that broke.
 */

function secretMatches(request: Request): boolean {
  const expected = env.SHIPROCKET_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-api-key") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Every status that means THE COURIER HAS THE SHIPMENT.
 *
 * Including label/AWB generation. From this app's point of view there is
 * no difference worth showing: once the consignment exists in
 * Shiprocket's system it has left our hands, there is a real tracking
 * number, and everything after that lives on the courier's own page.
 *
 * An earlier version of this split label and pickup into two states and
 * showed "booked, awaiting collection" in between. That was a distinction
 * this app has no business making — its terminal stage is "Forwarded to
 * courier", and a generated AWB IS the forwarding.
 *
 * Whatever stage the clock thinks the order is on, this jumps it
 * straight to handed_to_courier. A real courier record beats an estimate.
 */
const FORWARDED_STATUSES = new Set([
  // label / AWB exists
  "awb assigned", "awb generated", "label generated", "manifest generated",
  "ready to ship", "new", "invoiced",
  // pickup booked or attempted
  "pickup generated", "pickup scheduled", "pickup error", "pickup rescheduled",
  // physically moving
  "picked up", "shipped", "in transit", "out for delivery", "delivered",
]);

export const POST: RequestHandler = async ({ request }) => {
  if (!secretMatches(request)) return json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Supabase not configured" }, { status: 503 });

  const raw = await request.text();
  let payload: any = null;
  try { payload = JSON.parse(raw); } catch { /* keep raw */ }

  await supabase.from("captured_shiprocket_webhooks").insert({
    payload: payload ?? { raw },
    headers: Object.fromEntries(request.headers),
  });

  if (!payload) return json({ ok: true, parsed: false });

  const awb = String(payload.awb ?? payload.awb_code ?? "").trim();
  const orderId = String(payload.order_id ?? "").trim();
  const status = String(payload.current_status ?? payload.status ?? "").toLowerCase().trim();

  if (!FORWARDED_STATUSES.has(status)) {
    return json({ ok: true, parsed: true, action: "logged" });
  }

  // Match on our own order id first, then AWB — Shiprocket echoes the id
  // we sent, and that's a stronger key than an AWB that may not be
  // recorded on our side yet.
  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, tracking_id, current_stage, picked_up_at")
    .or(`dropy_order_id.eq.${orderId},tracking_id.eq.${orderId},last_mile_awb.eq.${awb}`)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) return json({ ok: true, parsed: true, action: "no matching order" });
  if (order.picked_up_at) return json({ ok: true, parsed: true, action: "already recorded" });

  // Jump straight to handed_to_courier from wherever the clock had it.
  await advanceToHandedToCourier(supabase, order.id, "Shiprocket", awb, null);

  await logSystemAudit("Shiprocket webhook", {
    action: "order.stage_change",
    orderId: order.id,
    before: { current_stage: order.current_stage },
    after: { current_stage: "handed_to_courier", last_mile_awb: awb },
    note: `Shiprocket reported "${status}" — forwarded, AWB ${awb}`,
  });

  return json({ ok: true, parsed: true, action: "advanced" });
};
