import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaffOrBridge } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";
import { calendarDays } from "$lib/dates";

/**
 * Extend the window on an order already in flight.
 *
 * A route is chosen when the parcel is pushed, on a promise of so many
 * working days. Ten days in, it can be plain that a 13-day route is
 * taking 16. Until now nobody could say so: an add-days endpoint existed
 * on the bridge, authenticated with the bridge secret and called by
 * nothing, so the only way to extend an order was raw SQL.
 *
 * This is the same operation with a staff session behind it.
 *
 * `shipping_days` is the whole window, so extending it moves the ETA AND
 * spreads the remaining stages -- each stage's time is a percentage of
 * the window, not a fixed offset. That is the right behaviour (a slower
 * journey is slower throughout, not fast until a sudden wait at the end)
 * but it does move dates the customer has already seen, which is why the
 * response reports both the old and new ETA for the UI to show.
 */
const MAX_TOTAL_DAYS = 30;
const MIN_TOTAL_DAYS = 1;

export const POST: RequestHandler = async ({ cookies, params, request }) => {
  /* A teammate in DOT admin, or Order Central calling in. */
  const guard = await requireStaffOrBridge(cookies, request);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));
  const addDays = Number(body.add_days);
  const reason = String(body.reason ?? "").trim();

  if (!Number.isFinite(addDays) || addDays === 0) {
    return json({ error: "How many days? Use a negative number to shorten." }, { status: 400 });
  }
  if (!Number.isInteger(addDays)) {
    return json({ error: "Days must be a whole number." }, { status: 400 });
  }
  /* A reason is required, not optional. This changes a date a customer
     has already been shown, and six months later "why is this order 19
     days?" has to be answerable from the audit trail alone. */
  if (!reason) {
    return json({ error: "Say why the window is changing." }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, tracking_id, shipping_days, order_date, current_stage, deleted_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!order || order.deleted_at) {
    return json({ error: "Order not found." }, { status: 404 });
  }

  const before = order.shipping_days ?? 12;
  const after = before + addDays;
  if (after > MAX_TOTAL_DAYS) {
    return json(
      { error: `That would make the window ${after} days. The limit is ${MAX_TOTAL_DAYS}.` },
      { status: 400 },
    );
  }
  if (after < MIN_TOTAL_DAYS) {
    return json({ error: `That would make the window ${after} days.` }, { status: 400 });
  }

  /* Both ETAs, from the ONE conversion in lib/dates. Computing a calendar
     window a second way here is how admin and the customer page came to
     disagree by 14h24m once. */
  const etaOf = (days: number) => {
    const d = new Date(order.order_date);
    d.setDate(d.getDate() + calendarDays(days));
    return d;
  };
  const etaBefore = etaOf(before);
  const etaAfter = etaOf(after);

  /* estimated_delivery is a STORED STRING, read straight out of the row
     by both the customer page and the admin one. The bridge's own
     add-days endpoint updates shipping_days alone, which stretches every
     stage while leaving the customer looking at the old date -- the same
     shape as the 14h24m disagreement that took four code paths to find.
     Both move together or neither does. */
  const { error } = await supabase
    .from("dropy_orders")
    .update({
      shipping_days: after,
      estimated_delivery: etaAfter.toLocaleDateString("en-GB",
        { day: "2-digit", month: "short", year: "numeric" }),
    })
    .eq("id", order.id);

  if (error) return json({ error: error.message }, { status: 500 });

  await logAudit(identity, {
    action: "order.add_days",
    orderId: params.id,
    before: { shipping_days: before, estimated_delivery: etaBefore.toISOString() },
    after: { shipping_days: after, estimated_delivery: etaAfter.toISOString() },
    note: `${addDays > 0 ? "+" : ""}${addDays} days (${before} → ${after}) — ${reason}`,
  });

  return json({
    ok: true,
    shipping_days: after,
    previous_days: before,
    eta_before: etaBefore.toISOString(),
    eta_after: etaAfter.toISOString(),
  });
};
