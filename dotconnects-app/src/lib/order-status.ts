import type { SupabaseClient } from "@supabase/supabase-js";
import { STAGES } from "$lib/types";
import { orderRouteStageLocation, suggestStageForOrderRoute } from "$lib/order-routes";
import { resolveVendor } from "$lib/vendor-catalog";
import { stampFor, etaFor, formatEta } from "$lib/dates";

/**
 * Pausing and resuming a parcel's clock — the ONLY writers for either.
 *
 * Both entry points (a teammate in DOT admin, and Order Central over the
 * bridge) used to write `current_stage` inline and nothing else. Three
 * things followed from that, all of them live until D1:
 *
 *   1. No customer ever saw the hold. The tracking page renders
 *      dropy_order_events, and neither endpoint wrote one — so a delayed
 *      customer got a card promising delivery, no date, and no reason.
 *
 *   2. Clearing the hold set current_stage to wherever the CLOCK had
 *      reached by then, so a parcel held a week jumped a week forward in
 *      one step and the delivery date never moved.
 *
 *   3. Both wrote status = 'Customs Clearance' whatever stage the parcel
 *      was at, so a box held over the Atlantic told the customer it was
 *      in Indian customs. Neither writes status now: the stage already
 *      says where the parcel is, and the page carries the hold itself.
 *
 * The teammate's reason is NOT passed to the customer. It is internal
 * shorthand and it stays in the audit log, which is the same rule
 * hold-event.ts follows for cancelled and damaged — one behaviour for
 * holds, not three.
 */
export type PauseResult = { error: string } | {
  ok: true;
  prior_stage: string;
  delayed_at: string;
};

export type ResumeResult = { error: string } | {
  ok: true;
  current_stage: string;
  paused_ms: number;
  delay_total_ms: number;
  estimated_delivery: string;
};

/** What the customer is told. One fixed line, whatever the real reason. */
const HOLD_LABEL = "Shipment on hold";
const HOLD_NOTE = "Our team is working on it.";

export async function pauseOrder(
  supabase: SupabaseClient,
  orderId: number | string,
  input: { reason: string },
): Promise<PauseResult> {
  /* The reason is NOT validated against DELAY_REASONS. It used to be,
     back when it was passed through to the customer's trail and a
     stray string would have been read by them. Under decision B the
     customer gets one fixed line, so the reason is audit-only — and
     validating it here would reject the free text DOC has always sent,
     for no gain to anyone. */
  const { data: orderRow, error: fetchErr } = await supabase
    .from("dropy_orders")
    .select("route_key, current_stage, items, timing_seed, delayed_at")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!orderRow) return { error: "Order not found." };
  if (orderRow.current_stage === "exception") {
    return { error: "This parcel is already paused." };
  }
  if (orderRow.current_stage === "damaged" || orderRow.current_stage === "cancelled") {
    return { error: `A ${orderRow.current_stage} parcel has no clock to pause.` };
  }
  if (orderRow.current_stage === "qc_check") {
    return { error: "This order has already reached QC — it can't be marked delayed." };
  }

  const priorStage = orderRow.current_stage ?? "order_placed";
  const stageIdx = Math.max(0, STAGES.findIndex((s) => s.key === priorStage));

  /* Stamped in the same write as the stage, so the pause can never exist
     without the instant it started — which is exactly the state the old
     flag left behind and why none of it was recoverable. */
  const delayedAt = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("dropy_orders")
    .update({ current_stage: "exception", delayed_at: delayedAt })
    .eq("id", orderId);
  if (updErr) return { error: updErr.message };

  const { data: events, error: fetchEvErr } = await supabase
    .from("dropy_order_events")
    .select("*")
    .eq("order_id", orderId);
  if (fetchEvErr) return { error: fetchEvErr.message };

  /* Everything the parcel genuinely passed is finished. Left alone, the
     last real stage keeps its live styling underneath a hold. */
  for (const ev of events ?? []) {
    const evIdx = STAGES.findIndex((s) => s.key === ev.stage);
    if (evIdx !== -1 && evIdx < stageIdx && ev.state !== "done") {
      await supabase.from("dropy_order_events").update({ state: "done" }).eq("id", ev.id);
    }
    if (ev.state === "current" && ev.stage !== "exception") {
      await supabase.from("dropy_order_events").update({ state: "done" }).eq("id", ev.id);
    }
  }

  const orderItems = typeof orderRow.items === "string"
    ? JSON.parse(orderRow.items) : (orderRow.items ?? []);
  const vendor = resolveVendor(orderItems, orderRow.timing_seed ?? 0);
  const location = orderRouteStageLocation(orderRow.route_key, priorStage as any, vendor);
  const existing = (events ?? []).find((ev) => ev.stage === "exception");

  /* Placed at the stage it interrupted rather than at the end of the
     trail: unlike cancelled and damaged, this parcel is expected to
     carry on from here. */
  if (existing) {
    const { error } = await supabase
      .from("dropy_order_events")
      .update({ state: "exception", happened_at: stampFor(), note: HOLD_NOTE, location })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("dropy_order_events").insert({
      order_id: orderId, stage: "exception", label: HOLD_LABEL,
      location, happened_at: stampFor(), note: HOLD_NOTE,
      state: "exception", sort_order: stageIdx,
    });
    if (error) return { error: error.message };
  }

  return { ok: true, prior_stage: priorStage, delayed_at: delayedAt };
}

export async function resumeOrder(
  supabase: SupabaseClient,
  orderId: number | string,
): Promise<ResumeResult> {
  const { data: row, error: fetchErr } = await supabase
    .from("dropy_orders")
    .select("route_key, current_stage, order_date, shipping_days, doorstep_days, timing_seed, delayed_at, delay_total_ms")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Order not found." };
  if (row.current_stage !== "exception") {
    return { error: "This parcel isn't paused." };
  }

  const now = new Date();
  const startedAt = row.delayed_at ? new Date(row.delayed_at).getTime() : NaN;
  /* A legacy row flagged before delayed_at existed banks nothing. Better
     than a guessed number of days moving a real customer's date. */
  const pausedMs = Number.isFinite(startedAt)
    ? Math.max(0, now.getTime() - startedAt) : 0;
  const banked = Number(row.delay_total_ms ?? 0);
  const delayTotalMs = (Number.isFinite(banked) && banked > 0 ? banked : 0) + pausedMs;

  /* Where the clock left off, not where it would have got to. This one
     line is the whole defect: it used to read the clock at plain `now`,
     so the parcel replayed every stage it had "missed" in a single jump
     and the customer watched a week pass in one refresh. */
  const resumeStage = suggestStageForOrderRoute(
    row.route_key, row.order_date, row.shipping_days ?? 12,
    row.timing_seed ?? 0, now.getTime() - delayTotalMs,
  );

  /* estimated_delivery is a STORED STRING the customer page reads
     directly. etaFor derives the same date from the same inputs, so
     leaving the string behind would put the two in disagreement the
     moment the hold ends — the exact drift add-days was written to
     avoid. One write, here, at the only moment the total is final. */
  const { dropy } = etaFor({
    order_date: row.order_date,
    shipping_days: row.shipping_days ?? 12,
    doorstep_days: row.doorstep_days,
    delayed_at: null,
    delay_total_ms: delayTotalMs,
  }, now);
  const estimatedDelivery = formatEta(dropy);

  const { error: updErr } = await supabase
    .from("dropy_orders")
    .update({
      current_stage: resumeStage,
      delayed_at: null,
      delay_total_ms: delayTotalMs,
      estimated_delivery: estimatedDelivery,
    })
    .eq("id", orderId);
  if (updErr) return { error: updErr.message };

  /* The hold stays on the trail — it happened, and a customer who saw it
     should still see why the dates moved. It just stops being live. */
  const { data: events } = await supabase
    .from("dropy_order_events")
    .select("id, stage, state")
    .eq("order_id", orderId);

  const hold = (events ?? []).find((ev: any) => ev.stage === "exception");
  if (hold && hold.state !== "done") {
    await supabase.from("dropy_order_events").update({ state: "done" }).eq("id", hold.id);
  }

  return {
    ok: true,
    current_stage: resumeStage,
    paused_ms: pausedMs,
    delay_total_ms: delayTotalMs,
    estimated_delivery: estimatedDelivery,
  };
}
