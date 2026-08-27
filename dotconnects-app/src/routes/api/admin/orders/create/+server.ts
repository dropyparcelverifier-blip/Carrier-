import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff } from "$lib/server/guards";
import { insertNewOrder, validateNewOrder, type NewOrderInput } from "$lib/server/create-order";
import { genTrackingId } from "$lib/tracking-id";
import { logAudit } from "$lib/server/audit";

/**
 * Manual order creation from the admin panel.
 *
 * Separate from the DOC bridge because the auth differs — this one is a
 * logged-in human with a session, so it logs as a user rather than a
 * system actor. Same insert path underneath.
 *
 * order_date is deliberately omitted: a manually created order has no
 * earlier real date to anchor to, so the clock starts now.
 */
export const POST: RequestHandler = async ({ cookies, request }) => {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard.response;
  const { identity } = guard;

  const body = await request.json().catch(() => ({}));
  const usId = String(body.us_order_id ?? "").trim();

  const input: NewOrderInput = {
    us_order_id: usId,
    dropy_order_id: String(body.dropy_order_id ?? "").trim(),
    // Generated, never taken from the form. A human-typed tracking ID
    // would break the format guarantees the whole system relies on.
    tracking_id: genTrackingId(usId),
    customer_name: String(body.customer_name ?? "").trim(),
    customer_mobile: String(body.customer_mobile ?? "").trim(),
    customer_email: body.customer_email || null,
    customer_address: body.customer_address || null,
    customer_city: String(body.customer_city ?? "").trim(),
    customer_pincode: body.customer_pincode || null,
    shipping_days: Number(body.shipping_days ?? 12),
    shipping_mode: body.shipping_mode || "Air Freight",
    carrier_name: null,
    awb_number: null,
    admin_notes: body.admin_notes || null,
    payment_status: body.payment_status || "Unpaid",
    items: Array.isArray(body.items) ? body.items : [],
  };

  const invalid = validateNewOrder(input);
  if (invalid) return json({ error: invalid }, { status: 400 });

  const result = await insertNewOrder(input);
  if (result.error !== undefined) return json({ error: result.error }, { status: 500 });

  await logAudit(identity, {
    action: "order.create",
    orderId: result.order.id,
    after: {
      tracking_id: result.order.tracking_id,
      dropy_order_id: input.dropy_order_id,
      us_order_id: usId,
    },
    note: `Created ${result.order.tracking_id} manually`,
  });

  return json({ ok: true, order: result.order });
};
