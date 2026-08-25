import { STAGES } from "$lib/types";
import { anchorFromRow, anchoredSuggestedStage, computeOverdue } from "$lib/stage-clock";
import { effectiveOrderStage } from "$lib/order-routes";
import { courierTrackingUrl } from "$lib/last-mile";

/**
 * Status payload for Order Central — architecture §8.1.
 *
 * Deliberately carries NO customer PII. DOC already holds the customer
 * record; repeating name, phone and address here would widen the blast
 * radius of a leaked bridge secret for no gain whatsoever.
 */

export type StatusRow = {
  id: string;
  tracking_id: string;
  dropy_order_id: string;
  us_order_id: string | null;
  current_stage: string;
  status: string;
  progress: number;
  estimated_delivery: string;
  order_date: string;
  shipping_days: number;
  route_key: string | null;
  timing_seed: number | null;
  clock_anchor_stage: string | null;
  clock_anchor_at: string | null;
  label_generated_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  replacement_of: string | null;
  last_mile_courier: string | null;
  last_mile_awb: string | null;
  last_mile_tracking_url: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export const STATUS_SELECT = `
  id, tracking_id, dropy_order_id, us_order_id, current_stage, status, progress,
  estimated_delivery, order_date, shipping_days, route_key, timing_seed,
  clock_anchor_stage, clock_anchor_at, label_generated_at, picked_up_at, delivered_at,
  replacement_of, last_mile_courier, last_mile_awb, last_mile_tracking_url, created_at
`;

export type StatusLeg = {
  tracking_id: string;
  dropy_order_id: string;
  us_order_id: string | null;
  stage: string;
  stage_label: string;
  status: string;
  progress: number;
  estimated_delivery: string | null;
  is_overdue: boolean;
  is_damaged: boolean;
  is_replacement: boolean;
  milestones: {
    label_generated_at: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
  };
  last_mile: {
    courier: string | null;
    awb: string | null;
    tracking_url: string | null;
  };
  order_date: string;
};

/**
 * Derives the same live stage the customer-facing tracker shows.
 *
 * DOC and /api/track MUST agree — if DOC syncs a stage to Shopify that
 * differs from what the customer sees on the tracker, the customer is
 * looking at two contradictory answers and support gets the call this
 * whole product exists to prevent.
 */
export function toStatusLeg(row: StatusRow): StatusLeg {
  const anchor = anchorFromRow(row.clock_anchor_stage, row.clock_anchor_at);

  const realEventStage: string | null =
    row.picked_up_at ? "handed_to_courier"
    : row.label_generated_at ? "qc_check"
    : null;

  const clockStage = anchor
    ? (anchoredSuggestedStage(row.route_key, row.order_date, row.shipping_days, anchor) ?? row.current_stage)
    : effectiveOrderStage(row.route_key, row.current_stage, row.order_date, row.shipping_days, row.timing_seed ?? 0);

  // Hold states are terminal for the clock — a damaged or held parcel
  // stays where it is regardless of elapsed time.
  const held = row.current_stage === "damaged" || row.current_stage === "exception";
  const stage = held ? row.current_stage : (realEventStage ?? clockStage);

  const overdue = computeOverdue({
    orderDate: row.order_date,
    shippingDays: row.shipping_days,
    storedStage: row.current_stage,
    labelGeneratedAt: row.label_generated_at,
    pickedUpAt: row.picked_up_at,
  });
  const stageInfo = STAGES.find((s) => s.key === stage);

  return {
    tracking_id: row.tracking_id,
    dropy_order_id: row.dropy_order_id,
    us_order_id: row.us_order_id,
    stage,
    stage_label:
      stage === "damaged" ? "Damaged in transit"
      : stage === "exception" ? "On hold"
      : (stageInfo?.label ?? row.status),
    status: row.status,
    progress: row.progress,
    // Null, not a date, when overdue — same rule the customer view uses.
    // DOC must not template a delivery date we've decided not to promise.
    estimated_delivery: overdue ? null : (row.estimated_delivery || null),
    is_overdue: overdue,
    is_damaged: row.current_stage === "damaged",
    is_replacement: row.replacement_of !== null,
    milestones: {
      label_generated_at: row.label_generated_at,
      picked_up_at: row.picked_up_at,
      delivered_at: row.delivered_at,
    },
    last_mile: {
      courier: row.last_mile_courier,
      awb: row.last_mile_awb,
      tracking_url: courierTrackingUrl(
        row.last_mile_courier,
        row.last_mile_awb,
        row.last_mile_tracking_url,
      ),
    },
    order_date: row.order_date,
  };
}
