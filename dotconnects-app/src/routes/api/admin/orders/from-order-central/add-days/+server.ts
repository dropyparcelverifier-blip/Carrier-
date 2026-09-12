import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkBridgeSecret } from "$lib/server/bridge-auth";
import { calendarDays } from "$lib/dates";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { logSystemAudit } from "$lib/server/audit";

const MAX_TOTAL_DAYS = 30;

/**
 * Extend an order's shipping window. Additive, capped.
 *
 * This is what un-overdues an order — and because overdue is computed at
 * read time rather than stored, it takes effect on the very next query
 * with no job to re-run.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!checkBridgeSecret(request)) return json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const trackingId = String(body.tracking_id ?? "").trim();
  const addDays = Number(body.add_days);

  if (!trackingId) return json({ error: "tracking_id is required" }, { status: 400 });
  if (!Number.isFinite(addDays) || addDays <= 0) {
    return json({ error: "add_days must be a positive number" }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, tracking_id, shipping_days, order_date, deleted_at")
    .eq("tracking_id", trackingId)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.deleted_at) return json({ error: "Order is deleted" }, { status: 409 });

  const next = Math.min(MAX_TOTAL_DAYS, (order.shipping_days ?? 12) + addDays);

  /* estimated_delivery is a STORED STRING that the customer page reads
     straight out of the row. Moving shipping_days alone stretches every
     stage while the customer keeps seeing the old date -- the same shape
     as the 14h24m ETA disagreement. Both move together. */
  const eta = new Date(order.order_date);
  eta.setDate(eta.getDate() + calendarDays(next));

  const { error } = await supabase
    .from("dropy_orders").update({
      shipping_days: next,
      estimated_delivery: eta.toLocaleDateString("en-GB",
        { day: "2-digit", month: "short", year: "numeric" }),
    }).eq("id", order.id);
  if (error) return json({ error: error.message }, { status: 500 });

  await logSystemAudit("Order Central (DOC)", {
    action: "order.add_days",
    orderId: order.id,
    before: { shipping_days: order.shipping_days },
    after: { shipping_days: next },
    note: `+${addDays} days (${order.shipping_days} → ${next})`,
  });

  return json({ ok: true, shipping_days: next, capped: next === MAX_TOTAL_DAYS });
};
