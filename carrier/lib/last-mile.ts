/**
 * The last-mile leg: DotConnects Logistics' Vashi warehouse -> customer doorstep.
 * Genuinely out of scope for this app's own stage timeline (see STAGES's
 * own note in lib/types.ts) — Shiprocket and Velocity are the two
 * fulfilment PLATFORMS DotConnects Logistics books this leg through, and once an
 * order is handed off, the real remaining tracking lives on THEIR page,
 * not ours.
 *
 * DEEP-LINK STATUS, per platform — confirmed by hand-testing in a real
 * browser, not assumed from URL shape alone (an earlier version of this
 * file wrongly concluded neither worked after one bad manual test —
 * likely tested before the shipment existed in the platform's system, or
 * hit a transient error; the URL shape itself was right both times):
 *
 *   Velocity — CONFIRMED WORKING (2026-08-20, verified by hand):
 *     https://www.velocityshipping.in/track/{AWB}
 *     https://www.velocityshipping.in/track/order?orderid={dropyOrderId}&number={customerPhone}
 *
 *   Shiprocket — CONFIRMED WORKING (2026-08-20, re-verified after the
 *   earlier false negative — fetched the real HTML for a genuine AWB and
 *   found actual server-rendered activity entries, e.g. "PickupFailed" /
 *   "ReadyForReceive" with real dates, not a blank form):
 *     https://shiprocket.co/tracking/{AWB}
 *   Page is white-labeled to this merchant account's own branding
 *   ("Dropy India - Order Tracking - By Shiprocket").
 *
 * Both confirmed working — deep-link straight to the real result, no
 * manual re-entry needed for either platform.
 *
 * dropy_orders.last_mile_tracking_url stores Order Central's own real URL
 * per order (populated by scripts/sync-last-mile.js) and is still
 * preferred over reconstructing one, since it's the most direct record of
 * what Order Central itself uses — the constructed pattern below is the
 * fallback for an order that hasn't been synced yet.
 */

export type LastMileCourier = "Shiprocket" | "Velocity";

export const LAST_MILE_COURIERS: LastMileCourier[] = ["Shiprocket", "Velocity"];

const TRACKING_PAGE: Record<LastMileCourier, string> = {
  Shiprocket: "https://www.shiprocket.in/shipment-tracking/",
  Velocity: "https://www.velocityshipping.in/track",
};

const TRACKING_DEEP_LINK: Record<LastMileCourier, (awb: string) => string> = {
  Shiprocket: (awb) => `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`,
  Velocity: (awb) => `https://www.velocityshipping.in/track/${encodeURIComponent(awb)}`,
};

/**
 * Resolves the tracking link to show, in priority order:
 *   1. `syncedUrl` — Order Central's own recorded URL (see
 *      dropy_orders.last_mile_tracking_url), when one exists.
 *   2. A confirmed-working deep link built from courier+awb.
 *   3. The platform's plain landing page, when there's no AWB at all.
 */
export function courierTrackingUrl(
  courier: LastMileCourier | string | null | undefined,
  awb?: string | null,
  syncedUrl?: string | null,
): string | null {
  if (syncedUrl && syncedUrl.trim()) return syncedUrl.trim();
  if (courier !== "Shiprocket" && courier !== "Velocity") return null;
  if (awb && awb.trim()) return TRACKING_DEEP_LINK[courier](awb.trim());
  return TRACKING_PAGE[courier];
}

/**
 * Velocity's order-id + phone lookup — an alternative to the AWB deep
 * link, useful when a customer has their order id/phone handy but not
 * the courier's own AWB. CONFIRMED WORKING (2026-08-20, verified by
 * hand). Shiprocket has no known equivalent.
 */
export function velocityOrderLookupUrl(dropyOrderId: string, customerPhone: string): string {
  const params = new URLSearchParams({ orderid: dropyOrderId, number: customerPhone });
  return `https://www.velocityshipping.in/track/order?${params.toString()}`;
}

/**
 * Deterministic pick between the two platforms — same hash approach as
 * lib/vendor-catalog.ts's pickVendorName, so the same order (same
 * timing_seed) always gets the same courier assignment rather than a
 * different one on every render. Used only as a sensible default when an
 * admin sets up the handover without picking one explicitly; the admin UI
 * still lets them override it, since which platform actually ships a given
 * order in real life isn't something this app can know on its own (see
 * README note on the Order Central webhook receiver for the real source
 * of truth once that's wired up).
 */
export function pickLastMileCourier(seed: number): LastMileCourier {
  const h = Math.sin(seed * 12.9898) * 43758.5453;
  const unit = h - Math.floor(h);
  return unit < 0.5 ? "Shiprocket" : "Velocity";
}
