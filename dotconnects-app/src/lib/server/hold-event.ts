import { orderRouteStageLocation } from "$lib/order-routes";
import { resolveVendor } from "$lib/vendor-catalog";
import { stampFor } from "$lib/dates";

/**
 * Record a hold state on the CUSTOMER'S trail.
 *
 * Cancel and damaged both wrote `current_stage` and an audit row and
 * nothing else. The audit log is staff-facing; `dropy_order_events` is
 * what the tracking page renders. So a cancelled parcel's timeline
 * showed one entry — "Booking confirmed · Order confirmed." — written
 * the day the order was created, and nothing ever contradicted it. A
 * customer told the parcel was cancelled still saw a page whose only
 * update said it was on its way.
 *
 * Written once, here, rather than twice in two endpoints: the two
 * timelines that disagreed, the five copied clock guards and the two
 * payload builders were all the same mistake, and this is the same
 * shape of rule.
 *
 * The teammate's reason is NOT passed through. It is internal shorthand
 * — "duplicate order", "wrong address given" — and it stays in the
 * audit log where staff can read it. The customer gets one fixed line.
 */

const HOLD = {
  cancelled: {
    label: "Order cancelled",
    note: "Order Cancelled by Vendor.",
  },
  damaged: {
    label: "Parcel damaged in transit",
    note: "This parcel was damaged on the way to India. Our team is handling it.",
  },
} as const;

/**
 * Hold events sort AFTER every journey stage.
 *
 * handed_to_courier, the last point on the route, is 13. A hold is
 * terminal and belongs at the end of the trail whatever stage the parcel
 * had reached, so it is placed beyond the route rather than inline —
 * unlike `exception`, which order-status.ts deliberately slots at the
 * stage it interrupted because the parcel is expected to continue.
 */
const HOLD_SORT_ORDER = 99;

export async function recordHoldEvent(
  supabase: any,
  orderId: number,
  stage: "cancelled" | "damaged",
  priorStage: string | null,
): Promise<void> {
  const copy = HOLD[stage];

  const { data: order, error: orderErr } = await supabase
    .from("dropy_orders")
    .select("route_key, items, timing_seed")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    console.error("[hold-event] could not read order for trail entry", {
      orderId, stage, error: orderErr?.message,
    });
    return;
  }

  const { data: events, error: evErr } = await supabase
    .from("dropy_order_events")
    .select("id, stage, state")
    .eq("order_id", orderId);

  if (evErr) {
    console.error("[hold-event] could not read existing events", {
      orderId, stage, error: evErr.message,
    });
    return;
  }

  /* Already recorded. Cancel and damaged both refuse a repeat with a
     409, but a retried request that got through once should not leave
     two identical entries on a customer's timeline. */
  if ((events ?? []).some((ev: any) => ev.stage === stage)) return;

  /* Nothing on the journey is still "current" once the journey has
     ended. Left alone, the last real stage keeps its live styling
     underneath a cancellation. */
  for (const ev of events ?? []) {
    if (ev.state === "current") {
      await supabase.from("dropy_order_events")
        .update({ state: "done" }).eq("id", ev.id);
    }
  }

  const items = typeof order.items === "string" ? JSON.parse(order.items) : (order.items ?? []);
  const vendor = resolveVendor(items, order.timing_seed ?? 0);

  const { error: insErr } = await supabase.from("dropy_order_events").insert({
    order_id: orderId,
    stage,
    label: copy.label,
    /* Where it had got to. Honest about the parcel's last known place
       rather than inventing a location for an event that has none. */
    location: orderRouteStageLocation(order.route_key, (priorStage ?? "order_placed") as any, vendor),
    happened_at: stampFor(),
    note: copy.note,
    state: "exception",
    sort_order: HOLD_SORT_ORDER,
  });

  /* The order row is already updated by the time this runs. A missing
     timeline entry must not fail the cancellation itself — but it must
     not vanish either, which is how this whole gap went unnoticed. */
  if (insErr) {
    console.error("[hold-event] failed to write trail entry", {
      orderId, stage, error: insErr.message,
    });
  }
}
