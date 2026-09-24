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
/**
 * India-stock parcels (DOC Build 5d): shipped from the India warehouse,
 * never a DotConnects consignment, so there is no row to look up. The code
 * carries the courier platform and the AWB — IS-VL-<awb> (Velocity) or
 * IS-SR-<awb> (Shiprocket) — and this forwards straight to that courier's
 * public tracking page. The customer must never see a DOT page for these,
 * so even an unverified or damaged code of this shape goes to the courier
 * (a public page keyed by the AWB they already hold), never to /t/.
 */
const INDIA_STOCK = /^IS-(VL|SR)-([A-Z0-9]{4,30})(?:-[a-z2-7]{0,10})?$/i;
export function indiaStockDestination(code: string): string | null {
  const m = String(code ?? "").trim().match(INDIA_STOCK);
  if (!m) return null;
  const awb = m[2].toUpperCase();
  return m[1].toUpperCase() === "VL"
    ? `https://www.velocityshipping.in/track/${awb}`
    : `https://shiprocket.co/tracking/${awb}`;
}

export const GET: RequestHandler = async ({ params }) => {
  const stock = indiaStockDestination(params.code);
  if (stock) {
    return new Response(null, {
      status: 302,
      headers: { location: stock, "cache-control": "no-store", "x-robots-tag": "noindex" },
    });
  }
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
