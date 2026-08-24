import { NextResponse } from "next/server";
import { requireAdminIdentity } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Manual override for the three real-event milestones — architecture §7.
 *
 * These normally arrive from a courier webhook. This is the fallback for
 * when one doesn't fire, which is not hypothetical: Velocity's route
 * captures payloads but doesn't parse them yet, so Velocity orders have
 * no automatic path at all. Without this control they would stick at
 * "QC approved" indefinitely with no way out short of raw SQL.
 *
 * Staff-level. Recording that a parcel was collected is daily work.
 */

const MILESTONES = {
  label: { column: "label_generated_at", stage: "qc_check", label: "Label generated" },
  picked: { column: "picked_up_at", stage: "handed_to_courier", label: "Picked up by courier" },
  delivered: { column: "delivered_at", stage: null, label: "Delivered" },
} as const;

type MilestoneKey = keyof typeof MILESTONES;

type Body = {
  milestone?: string;
  /** ISO timestamp. Defaults to now. Pass null to CLEAR the milestone. */
  at?: string | null;
  note?: string;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const identity = await requireAdminIdentity();
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { id } = await params;
    const body = (await request.json()) as Body;

    const key = body.milestone as MilestoneKey;
    const milestone = MILESTONES[key];
    if (!milestone) {
      return NextResponse.json(
        { error: `milestone must be one of: ${Object.keys(MILESTONES).join(", ")}` },
        { status: 400 },
      );
    }

    // Explicit null clears it — a mis-clicked "picked up" needs an undo
    // that isn't a database query.
    const clearing = body.at === null;
    const at = clearing ? null : body.at ? new Date(body.at) : new Date();
    if (at && Number.isNaN(at.getTime())) {
      return NextResponse.json({ error: "Invalid timestamp." }, { status: 400 });
    }

    const { data: order } = await supabase
      .from("dropy_orders")
      .select("id, tracking_id, current_stage, order_date, deleted_at, label_generated_at, picked_up_at, delivered_at")
      .eq("id", id)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.deleted_at) {
      return NextResponse.json({ error: "Order is deleted" }, { status: 409 });
    }

    if (at && at.getTime() < new Date(order.order_date).getTime()) {
      return NextResponse.json(
        { error: "That time is before the order was placed." },
        { status: 400 },
      );
    }

    // Milestones happen in order: label → picked → delivered. Recording a
    // pickup for a parcel that has no label means one of the two is wrong,
    // and silently accepting it produces a timeline nobody can explain
    // later.
    if (!clearing) {
      if (key === "picked" && !order.label_generated_at) {
        return NextResponse.json(
          { error: "Record the label first — a parcel can't be collected before it's labelled." },
          { status: 409 },
        );
      }
      if (key === "delivered" && !order.picked_up_at) {
        return NextResponse.json(
          { error: "Record the pickup first — a parcel can't be delivered before it's collected." },
          { status: 409 },
        );
      }
    }

    const update: Record<string, unknown> = {
      [milestone.column]: at ? at.toISOString() : null,
    };
    // Delivery is tracked but does NOT move current_stage: this app's own
    // journey ends at the handover (Gate 2). Delivered is operational
    // information for the team, not a customer-facing stage.
    if (milestone.stage && !clearing) update.current_stage = milestone.stage;

    const { error } = await supabase.from("dropy_orders").update(update).eq("id", id);
    if (error) {
      console.error("Milestone update failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAudit(identity, {
      action: key === "delivered" ? "order.mark_delivered" : "order.stage_change",
      orderId: id,
      before: { [milestone.column]: (order as any)[milestone.column] },
      after: { [milestone.column]: at ? at.toISOString() : null },
      note: body.note?.trim() ||
        (clearing ? `Cleared: ${milestone.label}` : `${milestone.label} (manual override)`),
    });

    return NextResponse.json({ ok: true, milestone: key, at: at?.toISOString() ?? null });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin/orders/[id]/milestone error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
