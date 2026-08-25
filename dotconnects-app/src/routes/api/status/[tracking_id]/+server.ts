import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkBridgeSecret } from "$lib/server/bridge-auth";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { STATUS_SELECT, toStatusLeg, type StatusRow } from "$lib/server/status-payload";

/**
 * Status read for Order Central.
 *
 * Reuses ORDER_CENTRAL_BRIDGE_SECRET rather than a separate read-only
 * secret: DOC already holds it and already has full WRITE access through
 * the same header, so a second secret adds rotation burden without
 * reducing any real privilege.
 *
 * Carries no customer PII — DOC already holds the customer record, and
 * repeating it here would widen the blast radius of a leaked secret for
 * nothing.
 */
export const GET: RequestHandler = async ({ request, params }) => {
  if (!checkBridgeSecret(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Supabase not configured" }, { status: 503 });

  const id = decodeURIComponent(params.tracking_id).trim();
  if (!id) return json({ error: "Tracking ID required" }, { status: 400 });

  const { data, error } = await supabase
    .from("dropy_orders")
    .select(STATUS_SELECT)
    .eq("tracking_id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return json({ error: error.message }, { status: 500 });
  // A soft-deleted order is a 404 here, same as on the public tracker —
  // DOC must not keep syncing a withdrawn order.
  if (!data) return json({ error: "Not found" }, { status: 404 });

  return json(toStatusLeg(data as unknown as StatusRow));
};
