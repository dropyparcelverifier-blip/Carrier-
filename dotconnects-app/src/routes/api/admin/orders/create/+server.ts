import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff } from "$lib/server/guards";
import { insertNewOrder, validateNewOrder, type NewOrderInput } from "$lib/server/create-order";
import { genTrackingId } from "$lib/tracking-id";
import { logAudit } from "$lib/server/audit";
import { BRANDS, brandOrderNo } from "$lib/brands";
import { signTrackCode } from "$lib/server/track-link";
import { PUBLIC_TRACK_BASE } from "$lib/brands";

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

  /* A brand login's order is always that brand's, numbered with its
     prefix — "1042" or "#1042" becomes "Rudra-1042". The Dropy team's
     form is unchanged. */
  const brand = identity.brand ?? null;
  let orderNo = String(body.dropy_order_id ?? "").trim();
  if (brand) {
    const n = brandOrderNo(brand, orderNo);
    if (!n) {
      return json({ error: `${BRANDS[brand].name} order no must be a number, e.g. 1042.` }, { status: 400 });
    }
    orderNo = n;
  }

  /* The day the customer ordered on the store, so the clock starts where
     DOC's pushes start it (the store order date) rather than today. A bare
     date is taken as midday IST. Optional: blank = now, as before. Never
     in the future, never more than 60 days back — an old typo would put a
     fresh parcel straight into "delayed". */
  let orderDate: string | null = null;
  const rawDate = String(body.order_date ?? "").trim();
  if (rawDate) {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? `${rawDate}T12:00:00+05:30` : rawDate;
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return json({ error: "Order date isn't a date." }, { status: 400 });
    if (ms > Date.now() + 60_000) return json({ error: "Order date can't be in the future." }, { status: 400 });
    if (ms < Date.now() - 60 * 864e5) return json({ error: "Order date is more than 60 days ago — check it." }, { status: 400 });
    orderDate = new Date(ms).toISOString();
  }

  const input: NewOrderInput = {
    us_order_id: usId,
    ...(orderDate ? { order_date: orderDate } : {}),
    dropy_order_id: orderNo,
    ...(brand ? { brand } : {}),
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
  if (result.error !== undefined) {
    // dropy_order_id is UNIQUE — say which order number, not a raw error.
    if (/duplicate key|23505/i.test(result.error) && /dropy_order_id/i.test(result.error)) {
      return json({ error: `${input.dropy_order_id} already has a tracking.` }, { status: 409 });
    }
    return json({ error: result.error }, { status: 500 });
  }

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

  const code = signTrackCode(String(result.order.tracking_id ?? ""));
  return json({
    ok: true,
    order: result.order,
    trackLink: code ? `${PUBLIC_TRACK_BASE}/t/${code}` : "",
  });
};
