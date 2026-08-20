import type { SupabaseClient } from "@supabase/supabase-js";
import { STAGES } from "@/lib/types";
import { orderRouteStageLocation } from "@/lib/order-routes";
import { resolveVendor } from "@/lib/vendor-catalog";
import { DELAY_REASONS, type DelayReason } from "@/lib/delay-reasons";

/**
 * Marks an order as "exception" (delayed/on hold) — shared between the
 * admin panel's PATCH route (app/api/admin/orders/[id]/route.ts) and the
 * Order Central bridge (app/api/admin/orders/from-order-central/delay/
 * route.ts), so the two entry points can't drift the way create-order.ts
 * already keeps order-creation in sync across its own two callers.
 *
 * Exception is a hold on whatever stage the order already sits at, not a
 * stage of its own on the 0-100% timeline — progress/status stay exactly
 * where they were (there's no STAGE_PROGRESS/stageToStatus entry for
 * "exception" to look up), and the event's location reuses the current
 * stage's own location text rather than inventing one for "exception",
 * which isn't a place.
 */
export type MarkExceptionResult = { error: string } | { ok: true };

export async function markOrderException(
  supabase: SupabaseClient,
  orderId: string,
  input: { reason: DelayReason; note?: string | null },
): Promise<MarkExceptionResult> {
  if (!DELAY_REASONS.includes(input.reason)) {
    return { error: `Invalid delay reason: ${input.reason}` };
  }

  const { data: orderRow, error: fetchErr } = await supabase
    .from("dropy_orders")
    .select("route_key, current_stage, progress, items, timing_seed")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!orderRow) return { error: "Order not found." };
  if (orderRow.current_stage === "qc_check") {
    return { error: "This order has already reached QC — it can't be marked delayed." };
  }

  const currentStageIdx = STAGES.findIndex((s) => s.key === orderRow.current_stage);
  const stageIdx = Math.max(0, currentStageIdx);

  const { error: updErr } = await supabase
    .from("dropy_orders")
    .update({ current_stage: "exception" })
    .eq("id", orderId);
  if (updErr) return { error: updErr.message };

  const { data: events, error: fetchEvErr } = await supabase
    .from("dropy_order_events")
    .select("*")
    .eq("order_id", orderId);
  if (fetchEvErr) return { error: fetchEvErr.message };

  for (const ev of events ?? []) {
    const evIdx = STAGES.findIndex((s) => s.key === ev.stage);
    if (evIdx !== -1 && evIdx < stageIdx && ev.state !== "done") {
      await supabase.from("dropy_order_events").update({ state: "done" }).eq("id", ev.id);
    }
  }

  const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST";
  const orderItems = typeof orderRow.items === "string" ? JSON.parse(orderRow.items) : (orderRow.items ?? []);
  const vendor = resolveVendor(orderItems, orderRow.timing_seed ?? 0);
  const location = orderRouteStageLocation(orderRow.route_key, (orderRow.current_stage ?? "order_placed") as any, vendor);
  const note = input.note?.trim() ? `${input.reason} — ${input.note.trim()}` : input.reason;
  const existing = (events ?? []).find((ev) => ev.stage === "exception");

  if (existing) {
    const { error } = await supabase
      .from("dropy_order_events")
      .update({ state: "exception", happened_at: ts, note })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("dropy_order_events").insert({
      order_id: orderId, stage: "exception", label: "Exception — shipment on hold",
      location, happened_at: ts, note, state: "exception", sort_order: stageIdx,
    });
    if (error) return { error: error.message };
  }

  return { ok: true };
}

/** Clears an exception, returning the order to whatever stage it's actually reached. */
export async function clearOrderException(
  supabase: SupabaseClient,
  orderId: string,
  resumeStage: string,
): Promise<MarkExceptionResult> {
  const stageInfo = STAGES.find((s) => s.key === resumeStage);
  if (!stageInfo) return { error: "Invalid stage to resume into." };

  const { error } = await supabase
    .from("dropy_orders")
    .update({ current_stage: resumeStage })
    .eq("id", orderId);
  if (error) return { error: error.message };

  return { ok: true };
}
