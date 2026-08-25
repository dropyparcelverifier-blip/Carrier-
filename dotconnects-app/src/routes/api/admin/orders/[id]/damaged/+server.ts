import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";
import { insertNewOrder, validateNewOrder, type NewOrderInput } from "$lib/server/create-order";
import { genTrackingId, extractPrefix } from "$lib/tracking-id";

/**
 * Mark damaged, optionally creating the replacement — the Gate 5 flow.
 *
 * The damaged order is NOT deleted or hidden. Its history stays visible
 * with a link forward, so a customer who has been checking that page for
 * nine days sees what happened and where their parcel is now, rather than
 * hitting a dead end.
 */
export const POST: RequestHandler = async ({ cookies, params, request }) => {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));

  const { data: order } = await supabase
    .from("dropy_orders").select("*").eq("id", params.id).maybeSingle();

  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.deleted_at) return json({ error: "Order is deleted" }, { status: 409 });
  if (order.current_stage === "damaged") {
    return json({ error: "Order is already marked damaged." }, { status: 409 });
  }

  // 1. Hold it where it is. "damaged" is a hold state outside the
  //    0-100% timeline, like exception — it does not advance.
  const { error: markErr } = await supabase
    .from("dropy_orders")
    .update({ current_stage: "damaged", status: "Damaged in transit" })
    .eq("id", params.id);
  if (markErr) return json({ error: markErr.message }, { status: 500 });

  await logAudit(identity, {
    action: "order.mark_damaged",
    orderId: params.id,
    before: { current_stage: order.current_stage },
    after: { current_stage: "damaged" },
    note: String(body.note ?? "").trim() || `${order.tracking_id} damaged in transit`,
  });

  // 2. Marking damaged and re-dispatching are separate decisions, and the
  //    second may come hours later.
  if (!body.replacement?.us_order_id) {
    return json({ ok: true, damaged: true, replacement: null });
  }

  // 3. Same customer, same items, new US ID, fresh clock.
  const usId = String(body.replacement.us_order_id).trim();
  const parentPrefix = extractPrefix(order.tracking_id);

  // dropy_order_id is UNIQUE so the replacement can't reuse it. The -R
  // suffix keeps the customer's prefix search working: the lookup already
  // matches `dropy_order_id like '<base>-%'`, so searching the ORIGINAL
  // number returns both rows with no new code.
  const base = String(order.dropy_order_id).replace(/-R\d+$/, "");
  const { data: siblings } = await supabase
    .from("dropy_orders").select("dropy_order_id").like("dropy_order_id", `${base}-R%`);
  const replacementId = `${base}-R${(siblings?.length ?? 0) + 1}`;

  const input: NewOrderInput = {
    us_order_id: usId,
    dropy_order_id: replacementId,
    tracking_id: genTrackingId(usId, parentPrefix),
    customer_name: order.customer_name,
    customer_mobile: order.customer_mobile,
    customer_email: order.customer_email ?? null,
    customer_address: order.customer_address ?? null,
    customer_city: order.customer_city,
    customer_pincode: order.customer_pincode ?? null,
    shipping_days: Number(body.replacement.shipping_days ?? order.shipping_days),
    shipping_mode: order.shipping_mode,
    order_date: null, // fresh clock — the replacement starts today
    carrier_name: null,
    awb_number: null,
    admin_notes: `Replacement for ${order.tracking_id} (damaged in transit)`,
    payment_status: order.payment_status,
    items: typeof order.items === "string" ? JSON.parse(order.items) : (order.items ?? []),
  };

  const invalid = validateNewOrder(input);
  if (invalid) {
    // The damage mark already succeeded and is correct. Reporting the
    // whole call as failed would be a lie about that.
    return json(
      { ok: true, damaged: true, replacement: null, replacementError: invalid },
      { status: 207 },
    );
  }

  const result = await insertNewOrder(input);
  if (result.error !== undefined) {
    return json(
      { ok: true, damaged: true, replacement: null, replacementError: result.error },
      { status: 207 },
    );
  }

  // 4. replacement_of lives on the NEW row pointing back, so following
  //    the chain is one lookup from either end.
  await supabase.from("dropy_orders")
    .update({ replacement_of: params.id }).eq("id", result.order.id);

  await logAudit(identity, {
    action: "order.create",
    orderId: result.order.id,
    after: { tracking_id: result.order.tracking_id, us_order_id: usId, replacement_of: order.tracking_id },
    note: `Redispatch of ${order.tracking_id} → ${result.order.tracking_id}`,
  });

  return json({
    ok: true, damaged: true,
    replacement: { id: result.order.id, tracking_id: result.order.tracking_id, dropy_order_id: replacementId },
  });
};
