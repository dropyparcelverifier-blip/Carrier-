import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkBridgeSecret } from "@/lib/bridge-auth";

export const dynamic = "force-dynamic";

/**
 * Bridge endpoint for Order Central to add extra shipping days to an
 * already-created dropy-final order when a leg is delayed — e.g. one US
 * order ID out of several on the same customer order runs late. Identified
 * by tracking_id (the per-leg id Order Central received back from the
 * initial /from-order-central push), not the internal uuid, since that's
 * the only handle Order Central holds onto per leg.
 *
 * Adds to shipping_days rather than replacing it, and recomputes
 * estimated_delivery from order_date the same way the admin PATCH route
 * does — keeps this additive/audit-friendly instead of silently
 * overwriting a value an admin may have already adjusted.
 *
 * Distinct from /from-order-central/delay: this pushes the ETA back
 * without changing current_stage (the shipment is still progressing, just
 * on a longer timeline), while /delay marks the order as actively on hold.
 */

type AddDaysBody = {
  tracking_id: string;
  extra_days: number;
  reason?: string;
};

export async function POST(request: Request) {
  try {
    if (!checkBridgeSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    let body: AddDaysBody;
    try {
      body = (await request.json()) as AddDaysBody;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const trackingId = body.tracking_id?.trim();
    if (!trackingId) {
      return NextResponse.json({ error: "tracking_id is required." }, { status: 400 });
    }
    const extraDays = Number(body.extra_days);
    if (!Number.isFinite(extraDays) || extraDays <= 0 || extraDays > 30) {
      return NextResponse.json({ error: "extra_days must be a number between 1 and 30." }, { status: 400 });
    }

    const { data: order, error: fetchErr } = await supabase
      .from("dropy_orders")
      .select("id, shipping_days, order_date, admin_notes")
      .eq("tracking_id", trackingId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Supabase fetch error (add-days):", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!order) return NextResponse.json({ error: `No order found for tracking_id ${trackingId}` }, { status: 404 });

    const newDays = Math.min(30, (order.shipping_days ?? 10) + extraDays);
    const eta = new Date(order.order_date);
    eta.setDate(eta.getDate() + Math.ceil(newDays * 1.4));

    const delayNote = `Delay: +${extraDays}d added${body.reason ? ` — ${body.reason.trim()}` : ""}`;
    const combinedNotes = [order.admin_notes, delayNote].filter(Boolean).join(" | ");

    const { error: updErr } = await supabase
      .from("dropy_orders")
      .update({
        shipping_days: newDays,
        estimated_delivery: eta.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        admin_notes: combinedNotes,
      })
      .eq("id", order.id);

    if (updErr) {
      console.error("Supabase update error (add-days):", updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tracking_id: trackingId, shipping_days: newDays, estimated_delivery: eta.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin/orders/from-order-central/add-days error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
