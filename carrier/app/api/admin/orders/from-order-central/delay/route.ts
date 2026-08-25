import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkBridgeSecret } from "@/lib/bridge-auth";
import { markOrderException, clearOrderException } from "@/lib/order-status";
import { DELAY_REASONS, type DelayReason } from "@/lib/delay-reasons";

export const dynamic = "force-dynamic";

/**
 * Bridge endpoint for Order Central to mark a dropy-final order as
 * delayed/on-hold (or clear that hold) — the same "exception" flow the
 * admin panel's PATCH route now exposes to a human, but reachable from
 * Order Central's own automation (e.g. it already knows a flight was
 * cancelled before anyone would think to open the admin panel).
 *
 * Identified by tracking_id, same as /from-order-central/add-days — the
 * only handle Order Central holds onto per leg once the initial
 * /from-order-central push hands a tracking_id back to it.
 *
 * POST { tracking_id, reason, note? } marks the order delayed.
 * POST { tracking_id, clear: true, resumeStage } clears it back to a real stage.
 */
type DelayBody = {
  tracking_id: string;
  reason?: string;
  note?: string;
  clear?: boolean;
  resumeStage?: string;
};

export async function POST(request: Request) {
  try {
    if (!checkBridgeSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    let body: DelayBody;
    try {
      body = (await request.json()) as DelayBody;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const trackingId = body.tracking_id?.trim();
    if (!trackingId) {
      return NextResponse.json({ error: "tracking_id is required." }, { status: 400 });
    }

    const { data: order, error: fetchErr } = await supabase
      .from("dropy_orders")
      .select("id")
      .eq("tracking_id", trackingId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Supabase fetch error (delay bridge):", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!order) return NextResponse.json({ error: `No order found for tracking_id ${trackingId}` }, { status: 404 });

    if (body.clear) {
      if (!body.resumeStage?.trim()) {
        return NextResponse.json({ error: "resumeStage is required to clear a delay." }, { status: 400 });
      }
      const result = await clearOrderException(supabase, order.id, body.resumeStage.trim());
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true, tracking_id: trackingId, cleared: true });
    }

    if (!body.reason || !DELAY_REASONS.includes(body.reason as DelayReason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${DELAY_REASONS.join(", ")}` },
        { status: 400 },
      );
    }

    const result = await markOrderException(supabase, order.id, {
      reason: body.reason as DelayReason,
      note: body.note,
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ ok: true, tracking_id: trackingId, reason: body.reason });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin/orders/from-order-central/delay error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
