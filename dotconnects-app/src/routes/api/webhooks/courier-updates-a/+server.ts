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

const PICKUP_STATUSES = new Set([
  "pickup generated", "pickup scheduled", "picked up", "shipped",
  "in transit", "out for delivery", "delivered",
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

  if (!PICKUP_STATUSES.has(status)) {
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

  await advanceToHandedToCourier(supabase, order.id, "Shiprocket", awb, null);

  await logSystemAudit("Shiprocket webhook", {
    action: "order.stage_change",
    orderId: order.id,
    before: { current_stage: order.current_stage },
    after: { current_stage: "handed_to_courier", last_mile_awb: awb },
    note: `Shiprocket reported "${status}" — AWB ${awb}`,
  });

  return json({ ok: true, parsed: true, action: "advanced" });
};
