import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkBridgeSecret } from "$lib/server/bridge-auth";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { STATUS_SELECT, toStatusLeg, type StatusRow } from "$lib/server/status-payload";

/**
 * Status for EVERY leg of one customer order. THIS is the one to poll.
 *
 * A replacement created in the admin panel has a tracking ID DOC never
 * saw, because DOC didn't request it. Polling by tracking ID can only
 * return things you already know about. Polling by ORDER surfaces the new
 * leg on the next sync — has_replacement is the signal to push it on.
 *
 * Matches the base id plus any suffixed leg:
 *   DROPY-3177      as pushed by DOC
 *   DROPY-3177-1    multi-leg split
 *   DROPY-3177-R1   redispatch after damage
 */
export const GET: RequestHandler = async ({ request, params }) => {
  if (!checkBridgeSecret(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Supabase not configured" }, { status: 503 });

  const base = decodeURIComponent(params.dropy_order_id).trim();
  if (!base) return json({ error: "Order ID required" }, { status: 400 });

  // Escape PostgREST pattern metacharacters so an id containing % or _
  // can't widen the match into other customers' orders.
  const escaped = base.replace(/[%_]/g, (c) => `\\${c}`);

  const { data, error } = await supabase
    .from("dropy_orders")
    .select(STATUS_SELECT)
    .or(`dropy_order_id.eq.${base},dropy_order_id.like.${escaped}-%`)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) return json({ error: error.message }, { status: 500 });
  if (!data?.length) return json({ error: "Not found" }, { status: 404 });

  const legs = (data as unknown as StatusRow[]).map(toStatusLeg);

  return json({
    dropy_order_id: base,
    leg_count: legs.length,
    has_replacement: legs.some((l) => l.is_replacement),
    legs,
  });
};
