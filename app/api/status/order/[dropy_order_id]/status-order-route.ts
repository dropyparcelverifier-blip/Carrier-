import { NextResponse } from "next/server";
import { checkBridgeSecret } from "@/lib/bridge-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { STATUS_SELECT, toStatusLeg, type StatusRow } from "@/lib/status-payload";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ dropy_order_id: string }> };

/**
 * Status for EVERY leg of one customer order — architecture §8.1.
 *
 * This is the endpoint that lets DOC discover tracking IDs it never saw
 * created. A replacement made in the admin panel after a damaged parcel
 * has a tracking ID DOC knows nothing about, because DOC didn't request
 * it. Polling by order rather than by tracking ID surfaces it on the next
 * sync, and DOC pushes it to Shopify from there.
 *
 * Matches the base order id plus any suffixed leg:
 *   DROPY-3177      the order as pushed by DOC
 *   DROPY-3177-1    multi-leg split (two US parcels, one order)
 *   DROPY-3177-R1   redispatch after damage
 *
 * Same prefix-matching the customer lookup already uses, so one number
 * finds everything belonging to that purchase.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    if (!checkBridgeSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { dropy_order_id } = await params;
    const base = decodeURIComponent(dropy_order_id).trim();
    if (!base) return NextResponse.json({ error: "Order ID required" }, { status: 400 });

    // Escape PostgREST's pattern metacharacters so an order id containing
    // % or _ can't widen the match into other customers' orders.
    const escaped = base.replace(/[%_]/g, (c) => `\\${c}`);

    const { data, error } = await supabase
      .from("dropy_orders")
      .select(STATUS_SELECT)
      .or(`dropy_order_id.eq.${base},dropy_order_id.like.${escaped}-%`)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Status-by-order lookup failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const legs = (data as unknown as StatusRow[]).map(toStatusLeg);

    return NextResponse.json({
      dropy_order_id: base,
      leg_count: legs.length,
      // True when any leg was created as a replacement — the signal DOC
      // uses to know a new tracking ID needs pushing to Shopify.
      has_replacement: legs.some((l) => l.is_replacement),
      legs,
    });
  } catch (err: any) {
    console.error("Uncaught GET /api/status/order/[dropy_order_id] error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
