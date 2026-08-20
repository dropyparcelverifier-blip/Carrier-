import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { pickOrderRoute, orderRouteStageLocation, randomTimingSeed } from "@/lib/order-routes";
import { resolveVendor } from "@/lib/vendor-catalog";
import { nowIST } from "@/lib/dates";
import type { AdminOrder, ShipmentMode } from "@/lib/types";

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
  items: { name: string; qty: number; weight_g: number; sku?: string; category?: string }[];
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
  const validItems = (body.items ?? []).filter((it) => it.name?.trim());
  if (!validItems.length) return "Add at least one item with a name.";
  for (const it of validItems) {
    const qty = Number(it.qty);
    if (!Number.isFinite(qty) || qty < 1) return `"${it.name.trim()}" needs a quantity of at least 1.`;
    const weight = Number(it.weight_g);
    if (!Number.isFinite(weight) || weight <= 0) return `"${it.name.trim()}" needs a weight greater than 0.`;
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

  const validItems = (body.items ?? []).filter((it) => it.name?.trim());
  const mappedItems = validItems.map((it) => ({
    name: it.name.trim(), qty: Number(it.qty) || 1,
    weight_g: Number(it.weight_g) || 0, sku: it.sku?.trim() || undefined,
    category: it.category?.trim() || undefined,
  }));
  const totalW = mappedItems.reduce((s, it) => s + it.weight_g * it.qty, 0) / 1000;
  const totalN = mappedItems.reduce((s, it) => s + it.qty, 0);
  const days = Number(body.shipping_days);
  const eta = new Date();
  eta.setDate(eta.getDate() + Math.ceil(days * 1.4));
  const route = pickOrderRoute();
  const timingSeed = randomTimingSeed();
  const vendor = resolveVendor(mappedItems, timingSeed);

  const { data, error: insertErr } = await supabase
    .from("dropy_orders")
    .insert({
      us_order_id: body.us_order_id.trim(),
      dropy_order_id: body.dropy_order_id, tracking_id: body.tracking_id,
      origin_country: "United States",
      route_key: route.key,
      timing_seed: timingSeed,
      customer_name: body.customer_name.trim(), customer_mobile: body.customer_mobile.trim(),
      customer_email: body.customer_email?.trim() || null,
      customer_address: body.customer_address?.trim() || null,
      customer_city: body.customer_city.trim(), customer_pincode: body.customer_pincode?.trim() || null,
      items: mappedItems, total_weight_kg: Math.round(totalW * 100) / 100, total_items: totalN,
      shipping_days: days, shipping_mode: body.shipping_mode,
      current_stage: "order_placed", status: "Order Placed", progress: 0,
      estimated_delivery: eta.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      carrier_name: body.carrier_name?.trim() || route.carrier,
      awb_number: body.awb_number?.trim() || null, admin_notes: body.admin_notes?.trim() || null,
      payment_status: body.payment_status,
    })
    .select();

  if (insertErr) return { error: insertErr.message };

  const order = data?.[0];
  if (order) {
    const ts = nowIST();
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

  return { order };
}
