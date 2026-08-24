import { NextResponse } from "next/server";
import { checkBridgeSecret } from "@/lib/bridge-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { STATUS_SELECT, toStatusLeg, type StatusRow } from "@/lib/status-payload";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ tracking_id: string }> };

/**
 * Status read for Order Central — architecture §8.1.
 *
 * Reuses ORDER_CENTRAL_BRIDGE_SECRET rather than issuing a separate
 * read-only secret: DOC already holds it and already has full WRITE
 * access through the same header, so a second secret would add rotation
 * burden without reducing any real privilege.
 *
 * Carries no customer PII — see lib/status-payload.ts.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    if (!checkBridgeSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { tracking_id } = await params;
    const id = decodeURIComponent(tracking_id).trim();
    if (!id) return NextResponse.json({ error: "Tracking ID required" }, { status: 400 });

    const { data, error } = await supabase
      .from("dropy_orders")
      .select(STATUS_SELECT)
      .eq("tracking_id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("Status lookup failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // A soft-deleted order is a 404 here, same as on the public tracker —
    // DOC must not keep syncing an order that was withdrawn.
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(toStatusLeg(data as unknown as StatusRow));
  } catch (err: any) {
    console.error("Uncaught GET /api/status/[tracking_id] error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
