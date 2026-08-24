import { NextResponse } from "next/server";
import { requireAdminIdentity } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";
import { STAGES } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type Body = {
  /** Stage to move to. Must be a real STAGES key. */
  stage?: string;
  /** When it happened. ISO string. Defaults to now. */
  happenedAt?: string;
  note?: string;
};

/**
 * Manual stage move with a real timestamp — architecture §4 Case 1.
 *
 * Writes clock_anchor_stage + clock_anchor_at, which re-scales the
 * REMAINING stages across the time left to the ETA. The customer's ETA
 * does not move (Gate 3 decision): being two days early is not worth
 * promising a date that may slip back.
 *
 * Staff-level — moving an order forward is daily work, not an admin
 * privilege. The audit log records who did it.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const identity = await requireAdminIdentity();
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { id } = await params;
    const body = (await request.json()) as Body;

    const stage = body.stage?.trim() ?? "";
    const stageIdx = STAGES.findIndex((s) => s.key === stage);
    if (stageIdx < 0) {
      return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
    }

    // Default to now, but accept an explicit time — the parcel may have
    // arrived this morning and been recorded this afternoon.
    const happenedAt = body.happenedAt ? new Date(body.happenedAt) : new Date();
    if (Number.isNaN(happenedAt.getTime())) {
      return NextResponse.json({ error: "Invalid timestamp." }, { status: 400 });
    }

    const { data: order } = await supabase
      .from("dropy_orders")
      .select("id, tracking_id, current_stage, order_date, deleted_at, clock_anchor_stage")
      .eq("id", id)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.deleted_at) {
      return NextResponse.json({ error: "Order is deleted" }, { status: 409 });
    }

    // A stage cannot have happened before the order existed.
    if (happenedAt.getTime() < new Date(order.order_date).getTime()) {
      return NextResponse.json(
        { error: "That time is before the order was placed." },
        { status: 400 },
      );
    }

    const currentIdx = STAGES.findIndex((s) => s.key === order.current_stage);
    // Forward only. Moving an order backwards would mean telling a
    // customer their parcel un-arrived; if something was recorded wrongly
    // that is a correction, not a stage move, and needs a deliberate
    // different action rather than a quiet reversal here.
    if (currentIdx >= 0 && stageIdx <= currentIdx) {
      return NextResponse.json(
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
      .eq("id", id);

    if (error) {
      console.error("Stage move failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAudit(identity, {
      action: "order.stage_change",
      orderId: id,
      before: { current_stage: order.current_stage, clock_anchor_stage: order.clock_anchor_stage },
      after: { current_stage: stage, clock_anchor_at: happenedAt.toISOString() },
      note: body.note?.trim() || `${order.current_stage} → ${stage} (manual)`,
    });

    return NextResponse.json({ ok: true, stage, anchoredAt: happenedAt.toISOString() });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin/orders/[id]/stage error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
