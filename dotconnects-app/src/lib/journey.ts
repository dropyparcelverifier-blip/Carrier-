import { STAGES, type StageKey } from "$lib/types";
import { suggestStageForOrderRoute } from "$lib/order-routes";

/**
 * Where the parcel physically got, and what we tell the customer.
 *
 * These were one variable, and that is why the two hold behaviours could
 * not coexist. `effectiveOrderStage` returned "damaged" for a damaged
 * parcel, which is right for the STATUS and wrong for the TIMELINE: the
 * synthetic backfill is driven off that same value, so suppressing the
 * stage also suppressed every stage the box had genuinely passed. A
 * customer told their parcel was damaged three weeks into its journey saw
 * a trail containing the booking and nothing else.
 *
 * Splitting them makes both spec'd behaviours fall out:
 *
 *   DAMAGED    the box is destroyed. Its journey FREEZES at the stage it
 *              had reached, and everything before that stays on the trail.
 *
 *   CANCELLED  the box is still in the air. Nobody stops a freighter
 *              because an order was cancelled. It keeps travelling and
 *              CAPS at the Vashi warehouse, because that is the last
 *              point it is going to — there is no onward delivery.
 *
 * So cancelled is not a hold at all. It is a live journey with a ceiling.
 */

/** The last point a cancelled parcel travels to. */
export const CANCEL_CAP: StageKey = "at_vashi_warehouse";

/** Journey has stopped for good — the box is not moving again. */
const FROZEN = new Set(["damaged", "exception"]);

export type JourneyView = {
  /** Where the box is, or got to. Always a real point on the route. */
  journey: StageKey;
  /** What the customer is told. A hold key, or the journey stage. */
  reported: string;
  /** Damaged or exception — the journey ended here. */
  frozen: boolean;
  /** Cancelled — still moving, but no further than the warehouse. */
  capped: boolean;
};

type Row = {
  current_stage: string;
  route_key: string | null;
  order_date: string;
  shipping_days: number;
  timing_seed?: number | null;
  held_at?: string | null;
};

const idx = (k: string) => STAGES.findIndex((s) => s.key === k);

export function journeyView(row: Row, realEventStage?: string | null): JourneyView {
  const seed = row.timing_seed ?? 0;
  const clockAt = (at?: number) =>
    suggestStageForOrderRoute(row.route_key, row.order_date, row.shipping_days, seed, at);

  /* Event-driven, never inferred from elapsed time: a real QC pass and a
     real handover. The clock must not reach either. */
  if (row.current_stage === "qc_check" || row.current_stage === "handed_to_courier") {
    return {
      journey: row.current_stage as StageKey,
      reported: row.current_stage,
      frozen: false, capped: false,
    };
  }

  if (FROZEN.has(row.current_stage)) {
    /* The stage it had reached when it stopped. held_at is what makes
       this answerable at all — current_stage was overwritten with the
       hold key, so the journey stage is not recoverable from the row.
       Rows held before held_at existed fall back to the booking, which
       is the old behaviour and no worse than it was. */
    const at = row.held_at ? new Date(row.held_at).getTime() : null;
    return {
      journey: at ? clockAt(at) : ("order_placed" as StageKey),
      reported: row.current_stage,
      frozen: true, capped: false,
    };
  }

  if (row.current_stage === "cancelled") {
    /* Still travelling. The clock runs exactly as it would for a live
       parcel, then stops at the warehouse — it is not going to a door. */
    const live = idx(clockAt());
    const cap = idx(CANCEL_CAP);
    return {
      journey: STAGES[Math.min(live, cap)].key as StageKey,
      reported: "cancelled",
      frozen: false, capped: true,
    };
  }

  /* Ordinary parcel. A real event outranks the clock; otherwise the
     clock, and never backwards past what the row already records. */
  const suggested = realEventStage ?? clockAt();
  const stage = idx(suggested) > idx(row.current_stage) ? suggested : row.current_stage;
  return {
    journey: stage as StageKey,
    reported: stage,
    frozen: false, capped: false,
  };
}
