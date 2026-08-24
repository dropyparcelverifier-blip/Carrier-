import { STAGES, type StageKey } from "@/lib/types";
import { getOrderRoute } from "@/lib/order-routes";

/**
 * Stage clock — architecture §4 (locked at Gate 3).
 *
 * Two distinct mechanisms, because the two real-world cases behave
 * differently and one shared formula gets both wrong:
 *
 *   Case 1 — admin nudges a stage forward (rare). The clock is still
 *            running and the ETA is a fixed endpoint. Remaining stages
 *            RE-SCALE across the time that is left. The customer's ETA
 *            does NOT move (Gate 3 decision).
 *
 *   Case 2 — label generated early (common). qc_check is terminal, the
 *            clock stops, and there is no remaining schedule. The problem
 *            is backfill: skipped stages must be COMPRESSED between where
 *            the clock actually was and when QC really happened, or the
 *            timeline renders out of order.
 *
 * Everything here is pure arithmetic on inputs — no database, no clock
 * reads beyond an injectable `now`, so it is fully testable.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Working days → calendar days. Matches create-order.ts's ETA maths. */
export const CALENDAR_FACTOR = 1.2;

/**
 * The order's ETA as a real timestamp.
 *
 * Deliberately computed from order_date + shipping_days rather than parsed
 * from dropy_orders.estimated_delivery, which is a TEXT column holding a
 * pre-formatted display string ("05 Sept 2026"). Date arithmetic on that
 * string is impossible in SQL and fragile in JS. This is the same
 * arithmetic that produced the string in the first place.
 */
export function etaAt(orderDate: string, shippingDays: number): Date {
  const created = new Date(orderDate).getTime();
  return new Date(created + shippingDays * CALENDAR_FACTOR * MS_PER_DAY);
}

/** timing_pct for a stage on a given route. */
export function stagePct(routeKey: string | null | undefined, stage: StageKey): number {
  return getOrderRoute(routeKey).stages[stage]?.timing_pct ?? 0;
}

export type ClockAnchor = {
  stage: StageKey;
  at: string; // ISO timestamp
};

/**
 * Case 1 — where a stage sits on the timeline once an anchor is set.
 *
 * Stages at or before the anchor keep their ORIGINAL schedule: they
 * already happened, and rewriting history would recompute order_placed to
 * a time before the order existed.
 *
 * Stages after the anchor re-scale across [anchor.at, eta]:
 *
 *     fraction = (p − pₐ) / (1 − pₐ)
 *     time     = anchor.at + fraction × (eta − anchor.at)
 *
 * Returns null when there is no anchor, so callers fall through to the
 * existing unanchored behaviour unchanged.
 */
export function anchoredStageTime(
  routeKey: string | null | undefined,
  stage: StageKey,
  orderDate: string,
  shippingDays: number,
  anchor: ClockAnchor | null,
): Date | null {
  if (!anchor) return null;

  const p = stagePct(routeKey, stage);
  const pAnchor = stagePct(routeKey, anchor.stage);

  // At or before the anchor — original schedule, untouched.
  if (p <= pAnchor) return null;

  const anchorMs = new Date(anchor.at).getTime();
  const etaMs = etaAt(orderDate, shippingDays).getTime();

  // Anchor set at or past the ETA leaves no window to spread across.
  // Collapse everything remaining onto the anchor instant rather than
  // producing times that run backwards.
  if (etaMs <= anchorMs) return new Date(anchorMs);

  // pAnchor of 1.0 would divide by zero — nothing comes after a stage at
  // 100%, so treat it the same way.
  if (pAnchor >= 1) return new Date(anchorMs);

  const fraction = (p - pAnchor) / (1 - pAnchor);
  return new Date(anchorMs + fraction * (etaMs - anchorMs));
}

/**
 * Case 1 — which stage the clock has reached, honouring an anchor.
 *
 * Never regresses below the anchor stage: the admin asserted the parcel
 * is there, so time passing cannot un-assert it.
 */
export function anchoredSuggestedStage(
  routeKey: string | null | undefined,
  orderDate: string,
  shippingDays: number,
  anchor: ClockAnchor | null,
  now: number = Date.now(),
): StageKey | null {
  if (!anchor) return null;

  let reached: StageKey = anchor.stage;
  for (const s of STAGES) {
    // handed_to_courier is a real handover, never clock-inferred — same
    // exclusion suggestStageForOrderRoute already makes.
    if (s.key === "handed_to_courier") continue;
    const t = anchoredStageTime(routeKey, s.key, orderDate, shippingDays, anchor);
    if (t && t.getTime() <= now) reached = s.key;
  }
  return reached;
}

/**
 * Case 2 — compress stages skipped by an early QC into the window between
 * where the clock genuinely was and when QC actually happened.
 *
 * Without this, an order placed 1 Aug with 12 shipping days whose label is
 * generated on 8 Aug renders "Arrived in India — 11 Aug" AFTER
 * "Quality check approved — 8 Aug". The timeline runs backwards.
 *
 * Returns a map of stage → timestamp for the skipped stages only.
 * Stages that already happened keep their real timestamps and are absent
 * from the result.
 */
export function compressSkippedStages(
  skipped: StageKey[],
  clockReachedAt: Date,
  realEventAt: Date,
): Map<StageKey, Date> {
  const out = new Map<StageKey, Date>();
  if (skipped.length === 0) return out;

  const startMs = clockReachedAt.getTime();
  const endMs = realEventAt.getTime();

  // The real event happened before the clock got there — nothing to
  // spread. Pin everything to the real event so nothing renders later
  // than it.
  if (endMs <= startMs) {
    for (const s of skipped) out.set(s, new Date(endMs));
    return out;
  }

  const span = endMs - startMs;
  skipped.forEach((s, i) => {
    // i+1 over n+1 leaves a gap before the real event, so the last
    // compressed stage never lands exactly on top of it.
    const fraction = (i + 1) / (skipped.length + 1);
    out.set(s, new Date(startMs + fraction * span));
  });
  return out;
}

/**
 * Is this order past its shipping window?
 *
 * Computed, never stored (architecture §6). A stored flag needs a cron job
 * to stay true and goes stale the moment add-days is called; this cannot.
 *
 * `currentStage` is typed as string, not StageKey, on purpose:
 * dropy_orders.current_stage can hold "exception" and "damaged", which are
 * hold states outside the 0–100% timeline and therefore outside StageKey
 * (architecture §5.2). Narrowing the parameter would make those two
 * unrepresentable at exactly the call site that needs them.
 *
 * Terminal and hold states are never overdue — a parcel that reached QC,
 * was handed to the courier, or is damaged has stopped travelling,
 * however long it took to get there.
 */
const NEVER_OVERDUE = new Set([
  "qc_check",
  "handed_to_courier",
  "damaged",
  "exception",
]);

export function isOverdue(
  orderDate: string,
  shippingDays: number,
  currentStage: string,
  now: number = Date.now(),
): boolean {
  if (NEVER_OVERDUE.has(currentStage)) return false;
  return now > etaAt(orderDate, shippingDays).getTime();
}

/**
 * Build the anchor from a database row. Both columns must be set — a half
 * anchor is meaningless and must not silently behave like a whole one.
 */
export function anchorFromRow(
  stage: string | null | undefined,
  at: string | null | undefined,
): ClockAnchor | null {
  if (!stage || !at) return null;
  if (!STAGES.some((s) => s.key === stage)) return null;
  return { stage: stage as StageKey, at };
}

/**
 * Single entry point for "when did/does this stage happen".
 *
 * Case 1 re-scaling when an anchor is set and the stage sits after it;
 * the original unanchored schedule otherwise. Every caller uses this so
 * the four timing paths cannot drift apart — the failure mode task 3.4
 * exists to catch is one call site still computing the old way while the
 * others honour the anchor, producing an order whose timeline contradicts
 * its own progress bar with nothing thrown.
 */
export function resolveStageTime(
  routeKey: string | null | undefined,
  stage: StageKey,
  orderDate: string,
  shippingDays: number,
  seed: number,
  anchor: ClockAnchor | null,
  unanchored: (
    routeKey: string | null | undefined,
    stage: StageKey,
    orderDate: string,
    shippingDays: number,
    seed: number,
  ) => Date,
): Date {
  const anchored = anchoredStageTime(routeKey, stage, orderDate, shippingDays, anchor);
  if (anchored) return anchored;

  // The anchor stage itself happened at the moment the admin recorded,
  // not wherever the original schedule put it.
  if (anchor && stage === anchor.stage) return new Date(anchor.at);

  return unanchored(routeKey, stage, orderDate, shippingDays, seed);
}

/**
 * Case 2 — which stages were skipped between where the clock genuinely
 * was and a real terminal event (an early QC).
 *
 * Excludes handed_to_courier, which is never clock-inferred.
 */
export function stagesBetween(from: StageKey, to: StageKey): StageKey[] {
  const fromIdx = STAGES.findIndex((s) => s.key === from);
  const toIdx = STAGES.findIndex((s) => s.key === to);
  if (fromIdx < 0 || toIdx < 0 || toIdx <= fromIdx + 1) return [];
  return STAGES.slice(fromIdx + 1, toIdx)
    .filter((s) => s.key !== "handed_to_courier")
    .map((s) => s.key);
}
