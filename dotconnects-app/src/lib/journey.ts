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

/**
 * Journey has stopped for good — the box is not moving again.
 *
 * `exception` used to live here, and that was the bug D1 fixes. A
 * delayed parcel is not destroyed; it is stopped, and it will start
 * again. Freezing it made the STAGE hold still while the clock behind it
 * kept running, so clearing the hold let the parcel catch itself up in
 * one jump and the delivery date never moved at all. Pausing is a third
 * behaviour, below.
 */
const FROZEN = new Set(["damaged"]);

export type JourneyView = {
  /** Where the box is, or got to. Always a real point on the route. */
  journey: StageKey;
  /** What the customer is told. A hold key, or the journey stage. */
  reported: string;
  /** Damaged — the journey ended here. */
  frozen: boolean;
  /** Cancelled — still moving, but no further than the warehouse. */
  capped: boolean;
  /**
   * Delayed — the clock is stopped and will resume from this point.
   * Readers that blank a date for `frozen` must blank it for this too:
   * a paused parcel has no honest date until it moves again.
   */
  paused: boolean;
  /**
   * Cancelled AND already at the warehouse. Nothing is travelling any
   * more, so there is no arrival left to date.
   *
   * `capped` alone was not enough. A cancelled parcel keeps its date
   * because it is still flying to Vashi and that is genuinely when it
   * lands — but once an Indian label has been cut, the box is
   * demonstrably here already and that same date becomes a promise
   * about the past.
   */
  closed: boolean;
};

type Row = {
  current_stage: string;
  route_key: string | null;
  order_date: string;
  shipping_days: number;
  timing_seed?: number | null;
  held_at?: string | null;
  /** Set while the clock is paused, null while it runs. */
  delayed_at?: string | null;
  /** Milliseconds spent paused across every hold. Never decreases. */
  delay_total_ms?: number | null;
};

const idx = (k: string) => STAGES.findIndex((s) => s.key === k);

/**
 * The instant the clock should be read at.
 *
 * ONE rule, and every stage question goes through it — the alternative
 * is a delay adjustment copied into each of the five readers, which is
 * how the clock guard itself ended up in five places.
 *
 *     effective now = (delayed_at ?? now) − delay_total_ms
 *
 * While paused, delayed_at pins it: the parcel stays exactly where it
 * stopped however long the hold runs. Once resumed, delayed_at is null
 * and the accumulated total holds the clock back by the length of every
 * hold so far, so the journey continues rather than jumping.
 */
export function effectiveNow(row: Row, at?: number): number {
  const total = Number(row.delay_total_ms ?? 0);
  const base = at ?? (row.delayed_at ? new Date(row.delayed_at).getTime() : Date.now());
  if (!Number.isFinite(base)) return Date.now();
  return base - (Number.isFinite(total) && total > 0 ? total : 0);
}

export function journeyView(row: Row, realEventStage?: string | null): JourneyView {
  const seed = row.timing_seed ?? 0;
  const clockAt = (at?: number) =>
    suggestStageForOrderRoute(row.route_key, row.order_date, row.shipping_days, seed,
      effectiveNow(row, at));

  /* Event-driven, never inferred from elapsed time: a real QC pass and a
     real handover. The clock must not reach either. */
  if (row.current_stage === "qc_check" || row.current_stage === "handed_to_courier") {
    return {
      journey: row.current_stage as StageKey,
      reported: row.current_stage,
      frozen: false, capped: false, paused: false, closed: false,
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
      frozen: true, capped: false, paused: false, closed: false,
    };
  }

  if (row.current_stage === "exception") {
    /* Stopped, not ended. clockAt() with no argument already reads the
       clock at the pause instant, so the stage the parcel had genuinely
       reached comes back on its own — no held_at, no replay, and none
       of the history loss that made a damaged parcel's trail collapse
       to the booking. That was the state a flagged parcel was in until
       this branch existed: delayed_at is what makes it answerable.

       A legacy row flagged before delayed_at existed has null, so the
       clock reads live and the parcel simply shows where it is. No
       date, no promise, no crash. */
    return {
      journey: clockAt(),
      reported: "exception",
      frozen: false, capped: false, paused: true, closed: false,
    };
  }

  if (row.current_stage === "cancelled") {
    /* Still travelling. The clock runs exactly as it would for a live
       parcel, then stops at the warehouse — it is not going to a door. */
    const live = idx(clockAt());
    const cap = idx(CANCEL_CAP);

    /* A REAL event outranks the cap, and the cap is a ceiling on the
       CLOCK, not on what happened.

       A parcel with an Indian label has been handled at Vashi — a
       tracking number is not cut with the box somewhere over the Arabian
       Sea. Without this floor the page put it wherever the clock had got
       to, which for an order cancelled the same day is mid-Atlantic, and
       printed a warehouse arrival date for a box already sitting in it. */
    const real = realEventStage ? idx(realEventStage) : -1;
    const journey = Math.max(real, Math.min(live, cap));

    return {
      journey: STAGES[journey].key as StageKey,
      reported: "cancelled",
      frozen: false, capped: true, paused: false,
      /* At the warehouse or past it: nothing is in the air, so there is
         no arrival to promise. Below it the parcel is still flying and
         keeps its date, exactly as before. */
      closed: journey >= idx(CANCEL_CAP),
    };
  }

  /* Ordinary parcel. A real event outranks the clock; otherwise the
     clock, and never backwards past what the row already records. */
  const suggested = realEventStage ?? clockAt();
  const stage = idx(suggested) > idx(row.current_stage) ? suggested : row.current_stage;
  return {
    journey: stage as StageKey,
    reported: stage,
    frozen: false, capped: false, paused: false, closed: false,
  };
}
