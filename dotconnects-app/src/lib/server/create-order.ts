import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { pickOrderRoute, orderRouteStageLocation, randomTimingSeed } from "$lib/order-routes";
import { resolveVendor } from "$lib/vendor-catalog";
import { nowIST } from "$lib/dates";
import { genTrackingId, extractPrefix, TRACKING_ID_MAX_RETRIES } from "$lib/tracking-id";
import type { AdminOrder, ShipmentMode } from "$lib/types";

/**
 * Real orders only ever ship Air Freight or Express Air — Ocean Freight is
 * disabled everywhere in the app (admin form dropdown, order-routes) since
 * it isn't an actual service today (see lib/order-routes.ts's own note).
 * Validated here, not just left to the UI, so the Order Central bridge
 * (app/api/admin/orders/from-order-central/route.ts) can't push an order
 * through with shipping_mode: "Ocean Freight" just because it isn't a
 * dropdown a human has to pick from.
 */
const ALLOWED_SHIPPING_MODES: ShipmentMode[] = ["Air Freight", "Express Air"];

/**
 * Shared insert logic behind both the admin "New Order" form
 * (app/api/admin/orders/route.ts) and the Order Central bridge
 * (app/api/admin/orders/from-order-central/route.ts) — keeps the
 * dropy_orders row shape and the initial "order_placed" event in sync
 * across both entry points.
 *
 * Real orders are US-origin only — Newark and JFK are the only two US
 * gateways with a genuine non-stop flight to Mumbai (both Air India; see
 * lib/order-routes.ts), so there's no origin-market field here the way the
 * display-only lib/routes.ts has. That 5-market picker (US/UK/Korea/Japan/
 * Australia) exists for the marketing site's /quote estimator, not for what
 * a real order actually ships on.
 */
export type NewOrderInput = {
  us_order_id: string; dropy_order_id: string; tracking_id: string;
  customer_name: string; customer_mobile: string; customer_email?: string | null;
  customer_address?: string | null; customer_city: string; customer_pincode?: string | null;
  shipping_days: number; shipping_mode: string;
  carrier_name?: string | null; awb_number?: string | null; admin_notes?: string | null;
  payment_status: string;
  /**
   * The REAL date the customer placed the order (Order Central's
   * shopify_created_at), not when the Order Central employee happened to
   * click "send to DotConnects" — those can be days apart if a push is
   * late. Without this, order_date defaulted to insert-time, so a
   * late-pushed order started the clock fresh at 0%/"Order Placed" even
   * though it might genuinely already be mid-transit or further. Passing
   * the real date lets effectiveOrderStage's existing clock math (see
   * lib/order-routes.ts) naturally place it wherever it should already
   * be. Omitted (undefined) for the admin's manual "New Order" form,
   * which has no earlier real date to anchor to — falls back to now().
   */
  order_date?: string | null;
  items: { name?: string; qty: number; weight_g: number; sku?: string; category?: string; price_usd?: number }[];
};

export function validateNewOrder(body: NewOrderInput): string | null {
  if (!body.customer_name?.trim()) return "Customer name is required.";
  if (!/^\d{10}$/.test(body.customer_mobile?.trim() ?? "")) return "Mobile must be exactly 10 digits.";
  if (body.customer_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer_email.trim())) {
    return "Enter a valid email address.";
  }
  if (!body.customer_city?.trim()) return "City is required.";
  if (body.customer_pincode?.trim() && !/^\d{6}$/.test(body.customer_pincode.trim())) {
    return "Pincode must be exactly 6 digits.";
  }
  // name is optional — an item from the Order Central bridge may carry
  // only a sku (see insertNewOrder's own note) — but it still needs SOME
  // identifier, name or sku, or there's nothing to show on the tracking
  // page or validate qty/weight against.
  const validItems = (body.items ?? []).filter((it) => it.name?.trim() || it.sku?.trim());
  if (!validItems.length) return "Add at least one item with a name or SKU.";
  for (const it of validItems) {
    const label = it.name?.trim() || it.sku!.trim();
    const qty = Number(it.qty);
    if (!Number.isFinite(qty) || qty < 1) return `"${label}" needs a quantity of at least 1.`;
    const weight = Number(it.weight_g);
    if (!Number.isFinite(weight) || weight <= 0) return `"${label}" needs a weight greater than 0.`;
  }
  if (!/^\d{3}-\d{7}-\d{7}$/.test(body.us_order_id?.trim() ?? "")) {
    return "US Order ID must be in format: 333-7777777-7777777";
  }
  if (!ALLOWED_SHIPPING_MODES.includes(body.shipping_mode as ShipmentMode)) {
    return `Shipping mode must be one of: ${ALLOWED_SHIPPING_MODES.join(", ")}.`;
  }
  const days = Number(body.shipping_days);
  if (!days || days < 1 || days > 30) {
    return "Shipping days must be between 1 and 30.";
  }
  return null;
}

/** Inserts one dropy_orders row + its initial "order_placed" event. Caller must validate first. */
export async function insertNewOrder(
  body: NewOrderInput,
): Promise<{ error: string; order?: undefined } | { order: AdminOrder; error?: undefined }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { error: "Supabase not configured" };

  // name is no longer required — the Order Central bridge may send an
  // item identified only by sku/category (see validateNewOrder's own
  // note). An item still needs SOME identifier though, so it isn't
  // filtered out entirely; falls back to the sku for display wherever
  // name would normally show (see components/ShipmentDetail.tsx,
  // AdminClient.tsx's item chips).
  const validItems = (body.items ?? []).filter((it) => it.name?.trim() || it.sku?.trim());
  const mappedItems = validItems.map((it) => ({
    name: it.name?.trim() || it.sku!.trim(), qty: Number(it.qty) || 1,
    weight_g: Number(it.weight_g) || 0, sku: it.sku?.trim() || undefined,
    category: it.category?.trim() || undefined,
    price_usd: Number.isFinite(Number(it.price_usd)) && Number(it.price_usd) > 0 ? Number(it.price_usd) : undefined,
  }));
  const totalW = mappedItems.reduce((s, it) => s + it.weight_g * it.qty, 0) / 1000;
  const totalN = mappedItems.reduce((s, it) => s + it.qty, 0);
  // Was never computed at all before this — every real order's
  // declared_value_usd silently stayed at the schema's 0 default
  // regardless of the items' real prices. Only items that actually
  // carry a price contribute; an order with none still totals 0 rather
  // than guessing a value.
  const declaredValueUsd = mappedItems.reduce((s, it) => s + (it.price_usd ?? 0) * it.qty, 0);
  const days = Number(body.shipping_days);
  // Anchor both the ETA and order_date to the REAL order-placed date when
  // one is given (Order Central's shopify_created_at) — not "now" — so a
  // late-pushed order's ETA reflects the real original promise instead of
  // being pushed later by however many days the push itself was delayed.
  const parsedOrderDate = body.order_date ? new Date(body.order_date) : null;
  const orderDate = parsedOrderDate && !Number.isNaN(parsedOrderDate.getTime()) ? parsedOrderDate : new Date();
  const eta = new Date(orderDate);
  // shipping_days is working days — 1.2x converts to calendar days
  // (weekends included). At the default of 10, this lands the promised
  // window at 12 calendar days.
  eta.setDate(eta.getDate() + Math.ceil(days * 1.2));
  const route = pickOrderRoute();
  const timingSeed = randomTimingSeed();
  const vendor = resolveVendor(mappedItems, timingSeed);

  // Tracking IDs are not collision-proof by construction (architecture
  // §5.5): two generations in the same millisecond for the same US order
  // produce the same string, and tracking_id is UNIQUE. Without this
  // retry the insert fails and the order is silently never created.
  // Each retry lands in a new millisecond, so one attempt is normally
  // enough — the loop is a safety net, not an expectation.
  let trackingId = body.tracking_id;
  let data: AdminOrder[] | null = null;
  let insertErr: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < TRACKING_ID_MAX_RETRIES; attempt++) {
    const result = await supabase
      .from("dropy_orders")
      .insert({
        us_order_id: body.us_order_id.trim(),
        dropy_order_id: body.dropy_order_id, tracking_id: trackingId,
        origin_country: "United States",
        route_key: route.key,
        timing_seed: timingSeed,
        order_date: orderDate.toISOString(),
        customer_name: body.customer_name.trim(), customer_mobile: body.customer_mobile.trim(),
        customer_email: body.customer_email?.trim() || null,
        customer_address: body.customer_address?.trim() || null,
        customer_city: body.customer_city.trim(), customer_pincode: body.customer_pincode?.trim() || null,
        items: mappedItems, total_weight_kg: Math.round(totalW * 100) / 100, total_items: totalN,
        declared_value_usd: Math.round(declaredValueUsd * 100) / 100,
        shipping_days: days, shipping_mode: body.shipping_mode,
        current_stage: "order_placed", status: "Order Placed", progress: 0,
        estimated_delivery: eta.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        carrier_name: body.carrier_name?.trim() || route.carrier,
        awb_number: body.awb_number?.trim() || null, admin_notes: body.admin_notes?.trim() || null,
        payment_status: body.payment_status,
      })
      .select();

    data = result.data as AdminOrder[] | null;
    insertErr = result.error;

    if (!insertErr) break;

    // Postgres 23505 = unique_violation. Only regenerate when it's the
    // tracking_id that collided — a duplicate dropy_order_id is a real
    // caller error and must surface, not be retried into a different row.
    const isTrackingCollision =
      insertErr.code === "23505" && insertErr.message.includes("tracking_id");
    if (!isTrackingCollision) break;

    trackingId = genTrackingId(body.us_order_id, extractPrefix(trackingId));
  }

  if (insertErr) return { error: insertErr.message };

  const order = data?.[0];
  if (order) {
    const ts = nowIST(orderDate);
    const { error: eventErr } = await supabase.from("dropy_order_events").insert({
      order_id: order.id, stage: "order_placed", label: "Order placed",
      location: orderRouteStageLocation(route.key, "order_placed", vendor), happened_at: ts,
      note: "Order confirmed.", state: "current", sort_order: 0,
    });
    // The order row itself is already committed at this point — don't fail
    // the whole request over a missing timeline entry, but don't swallow it
    // silently either; the caller can decide whether to surface a warning.
    if (eventErr) console.error("Failed to insert order_placed event:", eventErr, "order id:", order.id);
  }

  // The insert reported no error but returned no row — shouldn't happen,
  // but returning `{ order: undefined }` would break every caller's
  // narrowing. Surface it as an error instead of pretending it worked.
  if (!order) return { error: "Order insert returned no row." };

  return { order };
}
