import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";
import { STAGES } from "$lib/types";

/**
 * Manual stage move with a real timestamp — architecture §4 Case 1.
 *
 * Writes clock_anchor_stage + clock_anchor_at, which re-scales the
 * REMAINING stages across the time left to the ETA. The customer's ETA
 * does not move (Gate 3): being two days early isn't worth promising a
 * date that may slip back.
 *
 * Staff-level. Moving an order forward is daily work, not a privilege.
 */
export const POST: RequestHandler = async ({ cookies, params, request }) => {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));
  const stage = String(body.stage ?? "").trim();
  if (STAGES.findIndex((s) => s.key === stage) < 0) {
    return json({ error: "Unknown stage." }, { status: 400 });
  }

  const happenedAt = body.happenedAt ? new Date(body.happenedAt) : new Date();
  if (Number.isNaN(happenedAt.getTime())) {
    return json({ error: "Invalid timestamp." }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("dropy_orders")
    .select("id, tracking_id, current_stage, order_date, deleted_at, clock_anchor_stage")
    .eq("id", params.id)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.deleted_at) return json({ error: "Order is deleted" }, { status: 409 });

  if (happenedAt.getTime() < new Date(order.order_date).getTime()) {
    return json({ error: "That time is before the order was placed." }, { status: 400 });
  }

  // Forward only. Moving backwards tells a customer their parcel
  // un-arrived; a mis-recording is a correction, which is a different
  // deliberate action, not a quiet reversal here.
  const currentIdx = STAGES.findIndex((s) => s.key === order.current_stage);
  const targetIdx = STAGES.findIndex((s) => s.key === stage);
  if (currentIdx >= 0 && targetIdx <= currentIdx) {
    return json(
      { error: "Stage can only move forward. The order is already at or past that point." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("dropy_orders")
    .update({
      current_stage: stage,
      clock_anchor_stage: stage,
      clock_anchor_at: happenedAt.toISOString(),
    })
    .eq("id", params.id);

  if (error) return json({ error: error.message }, { status: 500 });

  await logAudit(identity, {
    action: "order.stage_change",
    orderId: params.id,
    before: { current_stage: order.current_stage, clock_anchor_stage: order.clock_anchor_stage },
    after: { current_stage: stage, clock_anchor_at: happenedAt.toISOString() },
    note: String(body.note ?? "").trim() || `${order.current_stage} → ${stage} (manual)`,
  });

  return json({ ok: true, stage, anchoredAt: happenedAt.toISOString() });
};
