import { NextResponse } from "next/server";
import { insertNewOrder, validateNewOrder, type NewOrderInput } from "@/lib/create-order";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkBridgeSecret } from "@/lib/bridge-auth";
import { genTrackingId } from "@/lib/tracking-id";
import { logSystemAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Bridge endpoint for Dropy Order Central (separate local Flask app) to push
 * a US-dispatched order into dropy-final as one or more dropy_orders rows.
 *
 * Not behind the admin cookie session — Order Central is a Python script,
 * not a logged-in browser — so it authenticates with a shared secret header
 * instead. Keep ORDER_CENTRAL_BRIDGE_SECRET equal on both sides.
 */

type BridgeLeg = {
  us_order_id: string;
  /** Defaults to 10 (the same default the admin's manual New Order form
   *  uses) when Order Central omits it — a leg without a known transit
   *  estimate yet shouldn't be rejected outright, just fall back to a
   *  reasonable placeholder that can be corrected later via
   *  /from-order-central/add-days once the real figure is known. */
  shipping_days?: number;
  /**
   * category is optional and passed through as-is when Order Central sends
   * it (must be one of lib/quote.ts's 8 ProductCategory values — anything
   * else is silently ignored, see vendor-catalog.ts isProductCategory). If
   * omitted, the vendor/warehouse/carrier assignment falls back to
   * guessing from the item's name (see lib/vendor-catalog.ts inferCategory).
   */
  items: { name?: string; qty: number; weight_g?: number; sku?: string; category?: string; price_usd?: number }[];
};

const DEFAULT_SHIPPING_DAYS = 10;

type BridgeBody = {
  dropy_order_id: string;
  shipping_mode?: string;
  customer_name: string;
  customer_mobile: string;
  customer_email?: string;
  customer_address?: string;
  customer_city: string;
  customer_pincode?: string;
  payment_status?: string;
  admin_notes?: string;
  /**
   * The REAL date the customer placed the order (Order Central's
   * shopify_created_at) — an ISO date string. Not when this API call
   * happens to fire, which can be days later than the real order date if
   * an employee pushes it late; without this, every order's clock started
   * fresh at push-time, understating real progress. See
   * lib/create-order.ts's own note on NewOrderInput.order_date.
   */
  order_date?: string;
  /**
   * One entry per US order ID actually shipping separately from the US
   * warehouse — each carries ONLY the items in that shipment (Order Central
   * knows the real per-leg split; this endpoint does not guess it). A
   * single-product order sends one leg; a multi-product order where items
   * arrive separately sends one leg per US order ID.
   */
  legs: BridgeLeg[];
};

export async function POST(request: Request) {
  try {
    if (!checkBridgeSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    let body: BridgeBody;
    try {
      body = (await request.json()) as BridgeBody;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const legs = (body.legs ?? []).filter((l) => l.us_order_id?.trim());
    if (!legs.length) {
      return NextResponse.json({ error: "At least one leg (us_order_id + items) is required." }, { status: 400 });
    }
    if (!body.dropy_order_id?.trim()) {
      return NextResponse.json({ error: "dropy_order_id is required." }, { status: 400 });
    }

    const created: any[] = [];
    const errors: { us_order_id: string; error: string }[] = [];

    // One dropy_orders row per leg (each US order ID ships separately from the
    // US warehouse, with only its own items). dropy_order_id has a unique
    // constraint, so a single-leg order keeps the bare id and a multi-leg
    // order gets a per-leg "-N" suffix — still visually grouped (shared
    // prefix) without violating uniqueness.
    const baseDropyId = body.dropy_order_id.trim();
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const usId = leg.us_order_id.trim();
      const legDropyId = legs.length > 1 ? `${baseDropyId}-${i + 1}` : baseDropyId;
      const orderInput: NewOrderInput = {
        us_order_id: usId,
        dropy_order_id: legDropyId,
        tracking_id: genTrackingId(usId),
        customer_name: body.customer_name,
        customer_mobile: body.customer_mobile,
        customer_email: body.customer_email ?? null,
        customer_address: body.customer_address ?? null,
        customer_city: body.customer_city,
        customer_pincode: body.customer_pincode ?? null,
        shipping_days: leg.shipping_days ?? DEFAULT_SHIPPING_DAYS,
        shipping_mode: body.shipping_mode || "Air Freight",
        order_date: body.order_date ?? null,
        // Was hardcoded to our own company name here, overriding
        // create-order.ts's real default (route.carrier — "Air India
        // Cargo", the genuine airline on this leg; see lib/order-routes.ts).
        // Every order created through this bridge showed OUR OWN NAME as
        // the "Carrier" on a customer-facing page, as if we were the
        // airline — leave unset so the real default actually applies,
        // same as the admin "New Order" form already does correctly.
        carrier_name: null,
        awb_number: null,
        admin_notes: body.admin_notes ?? null,
        payment_status: body.payment_status || "Unpaid",
        items: (leg.items ?? []).map((it) => ({
          name: it.name, qty: it.qty, weight_g: it.weight_g ?? 100, sku: it.sku, category: it.category,
          price_usd: it.price_usd,
        })),
      };

      const validationErr = validateNewOrder(orderInput);
      if (validationErr) {
        errors.push({ us_order_id: usId, error: validationErr });
        continue;
      }

      try {
        const result = await insertNewOrder(orderInput);
        if (result.error !== undefined) {
          errors.push({ us_order_id: usId, error: result.error });
          continue;
        }
        created.push(result.order);

        // DOC has no session — it authenticates with a shared secret — so
        // it logs as a system actor (architecture §5.4). Without this the
        // audit log shows tracking IDs appearing from nowhere.
        await logSystemAudit("Order Central (DOC)", {
          action: "order.tracking_generated",
          orderId: result.order.id,
          after: {
            tracking_id: result.order.tracking_id,
            us_order_id: usId,
            dropy_order_id: legDropyId,
          },
          note: `Tracking ${result.order.tracking_id} generated for US order ${usId}`,
        });
      } catch (err: any) {
        console.error("insertNewOrder threw (from-order-central):", err);
        errors.push({ us_order_id: usId, error: err.message || "Failed to create this leg." });
      }
    }

    if (!created.length) {
      return NextResponse.json({ error: "No orders created.", errors }, { status: 400 });
    }

    return NextResponse.json({ orders: created, errors: errors.length ? errors : undefined });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin/orders/from-order-central error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
