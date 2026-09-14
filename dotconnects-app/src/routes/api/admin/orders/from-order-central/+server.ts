import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkBridgeSecret } from "$lib/server/bridge-auth";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { insertNewOrder, validateNewOrder, type NewOrderInput } from "$lib/server/create-order";
import { genTrackingId } from "$lib/tracking-id";
import { logSystemAudit } from "$lib/server/audit";

/**
 * Bridge for Dropy Order Central.
 *
 * DOC is a Python script, not a logged-in browser, so it authenticates
 * with a shared secret header rather than the admin cookie.
 *
 * Accepts an explicit order_date, which is what makes migrating your
 * existing in-transit orders a push rather than a backfill script — send
 * each with its real dispatch date and the clock places it correctly on
 * the timeline immediately.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!checkBridgeSecret(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON" }, { status: 400 });

  const legs = Array.isArray(body.legs) && body.legs.length ? body.legs : [body];
  const created: unknown[] = [];
  const failed: unknown[] = [];

  /* A re-push after a cancellation supersedes the cancelled tracking.
     The DAMAGED path has always written replacement_of, which is what
     lets a customer's original link point forward; the CANCEL path wrote
     nothing, so the cancelled link was a dead end even once the page
     learned to render the cancelled state.

     replacement_of holds the ORIGINAL ROW'S id, not its tracking id, so
     the tracking id DOC sends is resolved here -- once for the whole
     call, not per leg. An id that matches nothing is ignored rather than
     failing the push: a broken forward link is worth less than a
     shipment, and DOC already logs what it sent. */
  let supersedesId: number | null = null;
  const supersedes = String(body.supersedes ?? "").trim();
  if (supersedes) {
    const { data: prior } = await supabase
      .from("dropy_orders")
      .select("id")
      .eq("tracking_id", supersedes)
      .maybeSingle();
    supersedesId = prior?.id ?? null;
    if (!supersedesId) {
      console.warn(`[bridge] supersedes "${supersedes}" matched no order — forward link not set.`);
    }
  }

  for (const [i, leg] of legs.entries()) {
    const usId = String(leg.us_order_id ?? "").trim();
    // One customer order can ship as several US parcels. dropy_order_id
    // is UNIQUE, so each leg gets a suffix.
    const legDropyId =
      legs.length > 1
        ? `${String(body.dropy_order_id ?? leg.dropy_order_id).trim()}-${i + 1}`
        : String(leg.dropy_order_id ?? body.dropy_order_id).trim();

    const input: NewOrderInput = {
      us_order_id: usId,
      dropy_order_id: legDropyId,
      tracking_id: genTrackingId(usId),
      customer_name: String(body.customer_name ?? "").trim(),
      customer_mobile: String(body.customer_mobile ?? "").trim(),
      customer_email: body.customer_email ?? null,
      customer_address: body.customer_address ?? null,
      customer_city: String(body.customer_city ?? "").trim(),
      customer_pincode: body.customer_pincode ?? null,
      shipping_days: Number(leg.shipping_days ?? body.shipping_days ?? 12),
      shipping_mode: body.shipping_mode ?? "Air Freight",
      order_date: body.order_date ?? null,
      carrier_name: null,
      awb_number: null,
      admin_notes: body.admin_notes ?? null,
      payment_status: body.payment_status ?? "Unpaid",
      /* Order Central computes this from Shiprocket at push time. It is
         built field by field here, so a field absent from this object is
         silently discarded no matter what DOC sends -- create-order
         accepted doorstep_days from the day it shipped and never once
         received it. */
      doorstep_days: leg.doorstep_days ?? body.doorstep_days ?? null,
      items: leg.items ?? body.items ?? [],
    };

    const invalid = validateNewOrder(input);
    if (invalid) { failed.push({ us_order_id: usId, error: invalid }); continue; }

    const result = await insertNewOrder(input);
    if (result.error !== undefined) {
      failed.push({ us_order_id: usId, error: result.error });
      continue;
    }

    if (supersedesId) {
      await supabase.from("dropy_orders")
        .update({ replacement_of: supersedesId })
        .eq("id", result.order.id);
    }

    created.push({
      tracking_id: result.order.tracking_id,
      dropy_order_id: legDropyId,
      us_order_id: usId,
      // Order Central shows the route on the order page. Without it back
      // in the response the only way to learn a consignment's route is a
      // second round trip for something already computed here.
      route_key: result.order.route_key,
    });

    // DOC has no session, so it logs as a system actor. Without this the
    // audit log shows tracking IDs appearing from nowhere.
    await logSystemAudit("Order Central (DOC)", {
      action: "order.tracking_generated",
      orderId: result.order.id,
      after: { tracking_id: result.order.tracking_id, us_order_id: usId, dropy_order_id: legDropyId },
      note: `Tracking ${result.order.tracking_id} generated for US order ${usId}`,
    });
  }

  // 207 when some legs landed and some didn't — reporting the whole call
  // as failed would be a lie about the ones that succeeded.
  const status = failed.length === 0 ? 200 : created.length ? 207 : 400;
  return json({ created, failed }, { status });
};
