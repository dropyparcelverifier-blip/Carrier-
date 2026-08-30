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
 * Statuses that mean THE COURIER HAS THE SHIPMENT.
 *
 * REWRITTEN FROM 775 REAL CAPTURED WEBHOOKS, not from the docs.
 *
 * The docs-derived list was wrong for a fifth of live traffic. Ten
 * statuses in it — "awb assigned", "label generated", "manifest
 * generated", "ready to ship", "invoiced", "pickup generated", "pickup
 * scheduled", "pickup error", "pickup rescheduled", "awb generated" —
 * have never once been sent. Meanwhile these WERE being sent and fell
 * straight through:
 *
 *   OUT FOR PICKUP              44   the real first forwarding signal
 *   REACHED AT DESTINATION HUB  48
 *   PICKUP EXCEPTION            21
 *   UNDELIVERED                  9
 *   RTO IN TRANSIT               8
 *   UNTRACEABLE                  2
 *   RTO INITIATED / OFD / DELIVERED
 *
 * That's 164 of 775 ignored. Any order whose first webhook was OUT FOR
 * PICKUP never forwarded at all.
 *
 * Compared lowercased — Shiprocket sends "DELIVERED" and "Delivered" for
 * the same event, so case can't be trusted.
 */
const FORWARDED_STATUSES = new Set([
  // AWB exists, courier assigned, not yet collected
  "new", "out for pickup", "pickup exception",
  // collected and moving
  "picked up", "shipped", "in transit", "reached at destination hub",
  "out for delivery", "delivered",
  // delivery attempted and failed — the courier still has it
  "undelivered", "untraceable",
  // returning: the forward leg completed before it turned around
  "rto initiated", "rto in transit", "rto ofd", "rto delivered",
]);

/**
 * Seen in real traffic but must NOT forward an order.
 *
 * "CANCELED" (28 occurrences, American spelling) means the shipment was
 * cancelled in Shiprocket. On an order already forwarded the team needs
 * to see it; on one never handed over, nothing happened.
 */
const POST_HANDOVER_ONLY = new Set(["canceled", "cancelled"]);
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

  const canForward = FORWARDED_STATUSES.has(status);
  if (!canForward && !POST_HANDOVER_ONLY.has(status)) {
    return json({ ok: true, parsed: true, action: "ignored", status });
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
  // Already forwarded — log to the admin trail rather than dropping it.
  // Pickup, failed pickup and delivery are the team's business; the
  // customer's journey ended at the handover.
  if (order.picked_up_at || !canForward) {
    await logSystemAudit("Shiprocket webhook", {
      action: "order.update",
      orderId: order.id,
      after: { courier_status: status },
      note: `Shiprocket: ${status}${awb ? ` — AWB ${awb}` : ""}`,
    });
    return json({ ok: true, parsed: true, action: "logged post-handover", status });
  }

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
