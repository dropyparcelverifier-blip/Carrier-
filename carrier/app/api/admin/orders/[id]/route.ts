import { NextResponse } from "next/server";
import { requireAdminSession, requireAdminIdentity } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logAudit, diffFields } from "@/lib/audit";
import { STAGES } from "@/lib/types";
import { STAGE_PROGRESS, stageToStatus } from "@/lib/admin-stages";
import { orderRouteStageLocation, orderRouteStageCarrier } from "@/lib/order-routes";
import { resolveVendor } from "@/lib/vendor-catalog";
import { nowIST } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { id } = await params;
    const { data: events, error } = await supabase
      .from("dropy_order_events")
      .select("*")
      .eq("order_id", id)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Supabase GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ events: events ?? [] });
  } catch (err: any) {
    console.error("Uncaught GET /api/admin/orders/[id] error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

type UpdateBody = {
  stage: string; note: string; paymentStatus: string;
  shippingDays: number; adminNotes: string; orderCreatedAt: string;
  lastMileCourier?: string; lastMileAwb?: string;
  /** Real tracking URL synced from Order Central (scripts/sync-last-mile.js)
   *  — optional, distinct from the courier+awb an admin can set by hand. */
  lastMileTrackingUrl?: string;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const identity = await requireAdminIdentity();
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { id } = await params;
    const body = (await request.json()) as UpdateBody;

    const { data: orderRow } = await supabase
      .from("dropy_orders")
      .select("route_key, current_stage, progress, items, timing_seed, shipping_days, payment_status, admin_notes, last_mile_courier, last_mile_awb, deleted_at, tracking_id")
      .eq("id", id)
      .maybeSingle();

    // A soft-deleted order must not be editable. Without this check a
    // deleted order stays fully mutable through its direct URL.
    if (orderRow?.deleted_at) {
      return NextResponse.json({ error: "Order is deleted" }, { status: 409 });
    }

    const lastMileCourier = body.lastMileCourier?.trim() || null;
    const lastMileAwb = body.lastMileAwb?.trim() || null;
    const lastMileTrackingUrl = body.lastMileTrackingUrl?.trim() || null;
    // Entering BOTH a courier and an AWB for an order already at (or being
    // set to) qc_check is itself the trigger for the handover — no separate
    // "mark as handed off" click needed. This isn't full webhook automation
    // (Shiprocket/Velocity's real webhook payload format isn't confirmed
    // yet — see lib/last-mile.ts), but it's grounded in a real fact an
    // admin enters once, not a guess or a timer.
    const stageForUpdate =
      lastMileCourier && lastMileAwb && (body.stage === "qc_check" || orderRow?.current_stage === "qc_check")
        ? "handed_to_courier"
        : body.stage;

    const isException = stageForUpdate === "exception";
    const stageInfo = STAGES.find((s) => s.key === stageForUpdate);
    if (!isException && !stageInfo) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });

    const orderItems = typeof orderRow?.items === "string" ? JSON.parse(orderRow.items) : (orderRow?.items ?? []);
    const vendor = resolveVendor(orderItems, orderRow?.timing_seed ?? 0);

    // Exception is a hold on the CURRENT stage, not a stage of its own on
    // the 0-100% timeline — it keeps whatever progress/status the order
    // already had (STAGE_PROGRESS/stageToStatus have no "exception" entry
    // to look up) rather than resetting to 0%/"Order Placed". sort_order
    // likewise reuses the current stage's position so the exception event
    // renders alongside it in the timeline, not at the very top.
    const currentStageIdx = STAGES.findIndex((s) => s.key === orderRow?.current_stage);
    const stageIdx = isException ? Math.max(0, currentStageIdx) : STAGES.findIndex((s) => s.key === stageForUpdate);
    const progress = isException ? (orderRow?.progress ?? 0) : (STAGE_PROGRESS[stageForUpdate] ?? 0);
    // handed_to_courier is the real final stage now that it exists — qc_check
    // alone no longer marks actual_delivery (that's QC-passed, not handed off).
    const isFinal = stageForUpdate === "handed_to_courier";

    const days = Number(body.shippingDays) || 10;
    const eta = body.orderCreatedAt ? new Date(body.orderCreatedAt) : new Date();
    // shippingDays is working days — 1.2x converts to calendar days
    // (weekends included), matching create-order.ts/order-routes.ts.
    eta.setDate(eta.getDate() + Math.ceil(days * 1.2));

    const { error: updErr } = await supabase
      .from("dropy_orders")
      .update({
        current_stage: stageForUpdate,
        progress,
        status: isException ? undefined : stageToStatus(stageForUpdate),
        payment_status: body.paymentStatus,
        shipping_days: days,
        estimated_delivery: eta.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        admin_notes: body.adminNotes?.trim() || null,
        ...(lastMileCourier ? { last_mile_courier: lastMileCourier } : {}),
        ...(lastMileAwb ? { last_mile_awb: lastMileAwb } : {}),
        ...(lastMileTrackingUrl ? { last_mile_tracking_url: lastMileTrackingUrl } : {}),
        ...(isFinal ? { actual_delivery: new Date().toISOString() } : {}),
      })
      .eq("id", id);

    if (updErr) {
      console.error("Supabase PATCH orders error:", updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const { data: events, error: fetchEvErr } = await supabase
      .from("dropy_order_events")
      .select("*")
      .eq("order_id", id);

    if (fetchEvErr) {
      console.error("Supabase PATCH fetch events error:", fetchEvErr);
    }

    for (const ev of events ?? []) {
      const evIdx = STAGES.findIndex((s) => s.key === ev.stage);
      if (evIdx !== -1 && evIdx < stageIdx && ev.state !== "done") {
        await supabase.from("dropy_order_events").update({ state: "done" }).eq("id", ev.id);
      }
    }

    const ts = nowIST();
    const existing = (events ?? []).find((ev) => ev.stage === stageForUpdate);
    // An exception's location is wherever the shipment currently sits, not
    // a new place — reuse the current stage's own location text rather
    // than looking one up for "exception" (which has none).
    const location = isException
      ? orderRouteStageLocation(orderRow?.route_key, (orderRow?.current_stage ?? "order_placed") as any, vendor)
      : orderRouteStageLocation(orderRow?.route_key, stageForUpdate as any, vendor);
    // handed_to_courier's mover is whichever last-mile platform was just
    // set (Shiprocket/Velocity), not the vendor-pickup carrier orderRouteStageCarrier
    // resolves for the first-mile leg — that function has no knowledge of
    // this order's own last-mile choice.
    const carrier = isException
      ? undefined
      : stageForUpdate === "handed_to_courier"
        ? (lastMileCourier ?? undefined)
        : orderRouteStageCarrier(stageForUpdate as any, vendor);

    if (existing) {
      await supabase
        .from("dropy_order_events")
        .update({ state: "current", happened_at: ts, note: body.note || existing.note, carrier: carrier ?? null })
        .eq("id", existing.id);
    } else {
      await supabase.from("dropy_order_events").insert({
        order_id: id, stage: stageForUpdate, label: isException ? "Exception — shipment on hold" : stageInfo!.label,
        location, happened_at: ts, carrier: carrier ?? null,
        note: body.note || null, state: isException ? "exception" : "current", sort_order: stageIdx,
      });
    }

    // Audit — record only what actually changed (diffFields), so the log
    // shows the meaningful edit instead of burying it under unchanged
    // columns. A stage move gets its own action so it's filterable.
    const before = {
      current_stage: orderRow?.current_stage,
      shipping_days: orderRow?.shipping_days,
      payment_status: orderRow?.payment_status,
      admin_notes: orderRow?.admin_notes,
      last_mile_courier: orderRow?.last_mile_courier,
      last_mile_awb: orderRow?.last_mile_awb,
    };
    const after = {
      current_stage: stageForUpdate,
      shipping_days: body.shippingDays,
      payment_status: body.paymentStatus,
      admin_notes: body.adminNotes,
      last_mile_courier: lastMileCourier,
      last_mile_awb: lastMileAwb,
    };
    const changed = diffFields(before, after);

    if (Object.keys(changed.after).length > 0) {
      const stageMoved = orderRow?.current_stage !== stageForUpdate;
      await logAudit(identity, {
        action: stageMoved ? "order.stage_change" : "order.update",
        orderId: id,
        before: changed.before,
        after: changed.after,
        note: stageMoved
          ? `${orderRow?.current_stage} → ${stageForUpdate}`
          : undefined,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Uncaught PATCH /api/admin/orders/[id] error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    // Admin only (architecture §5b). Staff do the daily work; destroying
    // an order is not daily work.
    const identity = await requireAdminIdentity();
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { id } = await params;

    // Read first so the audit row can record what was deleted. Without
    // this the log says "someone deleted something" and nothing more.
    const { data: existing } = await supabase
      .from("dropy_orders")
      .select("tracking_id, dropy_order_id, customer_name, current_stage, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (existing.deleted_at) {
      return NextResponse.json({ error: "Order is already deleted" }, { status: 409 });
    }

    // SOFT delete (architecture §5.1). The row and its whole event trail
    // survive — every read path filters on deleted_at is null instead.
    // A hard delete with no undo is the wrong default once more than one
    // person has the button.
    const { error } = await supabase
      .from("dropy_orders")
      .update({ deleted_at: new Date().toISOString(), deleted_by: identity.id })
      .eq("id", id);

    if (error) {
      console.error("Supabase soft-delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAudit(identity, {
      action: "order.delete",
      orderId: id,
      before: { deleted_at: null },
      after: { deleted_at: new Date().toISOString() },
      note: `Deleted ${existing.tracking_id} (${existing.customer_name})`,
    });

    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: any) {
    console.error("Uncaught DELETE /api/admin/orders/[id] error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
