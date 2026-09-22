import type { RequestHandler } from "./$types";
import { verifyTrackCode } from "$lib/server/track-link";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";

/**
 * /c/<code> — "track with the courier" from a customer message.
 *
 * Sends the customer to the Indian courier's own tracking page: the exact
 * URL the aggregator gave us, stored on the order as
 * last_mile_tracking_url. Nothing is built from the AWB, so couriers with
 * several URL formats (DTDC has three) never matter.
 *
 * No courier yet, or a code that isn't genuine → our own tracking page,
 * which says what's happening (or that the link isn't valid). Only an
 * http(s) URL is ever followed, so a bad value in the row can't turn
 * this into a redirect to anything else.
 */
export const GET: RequestHandler = async ({ params }) => {
  const own = `/t/${encodeURIComponent(params.code)}`;
  const id = verifyTrackCode(params.code);
  let dest = own;

  if (id) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from("dropy_orders")
        .select("last_mile_tracking_url")
        .ilike("tracking_id", id)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (error) console.error("[c] courier link lookup failed:", error.message);
      const url = String((data as { last_mile_tracking_url?: string } | null)?.last_mile_tracking_url ?? "");
      if (/^https?:\/\//i.test(url)) dest = url;
    }
  }

  return new Response(null, {
    status: dest === own ? 303 : 302,
    headers: { location: dest, "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
};
