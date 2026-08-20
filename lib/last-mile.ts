/**
 * The last-mile leg: DotConnects Logistics' Vashi warehouse -> customer doorstep.
 * Genuinely out of scope for this app's own stage timeline (see STAGES's
 * own note in lib/types.ts) — Shiprocket and Velocity are the two
 * fulfilment PLATFORMS DotConnects Logistics books this leg through, and once an
 * order is handed off, the real remaining tracking lives on THEIR page,
 * not ours.
 *
 * URL pattern: NOT a working deep link, despite the URL structure
 * suggesting one. Order Central's own local database (dropy_order_central.db,
 * `orders` table) stores a `tracking_url` per real dispatched order in the
 * form https://www.velocityshipping.in/track/{AWB} or
 * https://shiprocket.co/tracking/{AWB} — but manually clicking one of these
 * (verified directly, not assumed) lands on the platform's plain blank
 * search form, AWB field empty, no auto-fill or auto-submit. The AWB in
 * the path is apparently ignored by both platforms' frontends. So: link to
 * the plain landing page and show the AWB as copyable text for the
 * customer to paste in themselves — the same pattern this file used
 * before a deep-link pattern was (wrongly) assumed to work from the URL
 * shape alone. Do not "upgrade" this again without actually clicking a
 * real constructed URL and confirming it pre-fills something, not just
 * matching a plausible-looking pattern in stored data.
 *
 * dropy_orders.last_mile_tracking_url can still store Order Central's own
 * real URL per order (populated by scripts/sync-last-mile.js) — kept as
 * the top-priority source below since it's still the most accurate record
 * of what Order Central itself considers this shipment's tracking link,
 * even though it doesn't currently do anything more useful than the plain
 * landing page when clicked.
 */

export type LastMileCourier = "Shiprocket" | "Velocity";

export const LAST_MILE_COURIERS: LastMileCourier[] = ["Shiprocket", "Velocity"];

const TRACKING_PAGE: Record<LastMileCourier, string> = {
  Shiprocket: "https://www.shiprocket.in/shipment-tracking/",
  Velocity: "https://www.velocityshipping.in/track",
};

/**
 * Resolves the tracking link to show: `syncedUrl` (Order Central's own
 * recorded URL, see dropy_orders.last_mile_tracking_url) if one exists,
 * otherwise the platform's plain landing page. Never constructs a deep
 * link from courier+awb — confirmed not to work, see the note above.
 */
export function courierTrackingUrl(
  courier: LastMileCourier | string | null | undefined,
  _awb?: string | null,
  syncedUrl?: string | null,
): string | null {
  if (syncedUrl && syncedUrl.trim()) return syncedUrl.trim();
  if (courier === "Shiprocket" || courier === "Velocity") return TRACKING_PAGE[courier];
  return null;
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
