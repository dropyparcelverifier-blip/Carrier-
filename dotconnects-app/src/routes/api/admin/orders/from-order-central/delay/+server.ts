import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkBridgeSecret } from "$lib/server/bridge-auth";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { logSystemAudit } from "$lib/server/audit";

/**
 * Put an order on hold. DOC-driven.
 *
 * "exception" is a HOLD STATE, not a position on the timeline — the
 * parcel stops where it is and the clock stops mattering.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!checkBridgeSecret(request)) return json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const trackingId = String(body.tracking_id ?? "").trim();
  const reason = String(body.reason ?? "").trim();

  if (!trackingId) return json({ error: "tracking_id is required" }, { status: 400 });

  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, tracking_id, current_stage, deleted_at")
    .eq("tracking_id", trackingId)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.deleted_at) return json({ error: "Order is deleted" }, { status: 409 });

  const { error } = await supabase
    .from("dropy_orders")
    .update({ current_stage: "exception", status: "Customs Clearance" })
    .eq("id", order.id);
  if (error) return json({ error: error.message }, { status: 500 });

  await logSystemAudit("Order Central (DOC)", {
    action: "order.mark_delayed",
    orderId: order.id,
    before: { current_stage: order.current_stage },
    after: { current_stage: "exception" },
    note: reason || "Marked delayed by Order Central",
  });

  return json({ ok: true });
};
