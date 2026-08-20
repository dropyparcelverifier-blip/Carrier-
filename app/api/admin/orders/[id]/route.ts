import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { STAGES } from "@/lib/types";
import { STAGE_PROGRESS, stageToStatus } from "@/lib/admin-stages";
import { orderRouteStageLocation, orderRouteStageCarrier } from "@/lib/order-routes";
import { resolveVendor } from "@/lib/vendor-catalog";

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
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { id } = await params;
    const body = (await request.json()) as UpdateBody;

    const { data: orderRow } = await supabase
      .from("dropy_orders")
      .select("route_key, current_stage, progress, items, timing_seed")
      .eq("id", id)
      .maybeSingle();

    const lastMileCourier = body.lastMileCourier?.trim() || null;
    const lastMileAwb = body.lastMileAwb?.trim() || null;
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
    eta.setDate(eta.getDate() + Math.ceil(days * 1.4));

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

    const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST";
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

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Uncaught PATCH /api/admin/orders/[id] error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { id } = await params;
    await supabase.from("dropy_order_events").delete().eq("order_id", id);
    const { error } = await supabase.from("dropy_orders").delete().eq("id", id);

    if (error) {
      console.error("Supabase DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Uncaught DELETE /api/admin/orders/[id] error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}