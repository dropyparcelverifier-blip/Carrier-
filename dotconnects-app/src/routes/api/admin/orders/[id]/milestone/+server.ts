import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";

/**
 * Manual override for the three real-event milestones — architecture §7.
 *
 * Normally these arrive from a courier webhook. This is the fallback when
 * one doesn't fire, which is not hypothetical: Velocity's route captures
 * payloads but doesn't parse them yet, so Velocity orders have no
 * automatic path. Without this they stick at "QC approved" forever with
 * no way out short of raw SQL.
 */
const MILESTONES = {
  label:     { column: "label_generated_at", stage: "qc_check",          label: "Label generated" },
  picked:    { column: "picked_up_at",       stage: "handed_to_courier", label: "Picked up by courier" },
  delivered: { column: "delivered_at",       stage: null,                label: "Delivered" },
} as const;

type Key = keyof typeof MILESTONES;

export const POST: RequestHandler = async ({ cookies, params, request }) => {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));
  const key = body.milestone as Key;
  const milestone = MILESTONES[key];
  if (!milestone) {
    return json(
      { error: `milestone must be one of: ${Object.keys(MILESTONES).join(", ")}` },
      { status: 400 },
    );
  }

  // Explicit null clears it — a mis-clicked "picked up" needs an undo
  // that isn't a database query.
  const clearing = body.at === null;
  const at = clearing ? null : body.at ? new Date(body.at) : new Date();
  if (at && Number.isNaN(at.getTime())) {
    return json({ error: "Invalid timestamp." }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, tracking_id, order_date, deleted_at, label_generated_at, picked_up_at, delivered_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.deleted_at) return json({ error: "Order is deleted" }, { status: 409 });
  if (at && at.getTime() < new Date(order.order_date).getTime()) {
    return json({ error: "That time is before the order was placed." }, { status: 400 });
  }

  // Milestones happen in order. Recording a pickup for a parcel with no
  // label means one of the two is wrong, and accepting it silently
  // produces a timeline nobody can explain later.
  if (!clearing) {
    if (key === "picked" && !order.label_generated_at) {
      return json(
        { error: "Record the label first — a parcel can't be collected before it's labelled." },
        { status: 409 },
      );
    }
    if (key === "delivered" && !order.picked_up_at) {
      return json(
        { error: "Record the pickup first — a parcel can't be delivered before it's collected." },
        { status: 409 },
      );
    }
  }

  const update: Record<string, unknown> = {
    [milestone.column]: at ? at.toISOString() : null,
  };
  // Delivery does NOT move current_stage: this app's journey ends at the
  // handover (Gate 2). Delivered is operational information for the team,
  // not a customer-facing stage.
  if (milestone.stage && !clearing) update.current_stage = milestone.stage;

  const { error } = await supabase.from("dropy_orders").update(update).eq("id", params.id);
  if (error) return json({ error: error.message }, { status: 500 });

  await logAudit(identity, {
    action: key === "delivered" ? "order.mark_delivered" : "order.stage_change",
    orderId: params.id,
    before: { [milestone.column]: (order as any)[milestone.column] },
    after: { [milestone.column]: at ? at.toISOString() : null },
    note: String(body.note ?? "").trim() ||
      (clearing ? `Cleared: ${milestone.label}` : `${milestone.label} (manual override)`),
  });

  return json({ ok: true, milestone: key, at: at?.toISOString() ?? null });
};
