/**
 * The last-mile leg: DotConnects Logistics' Vashi warehouse -> customer doorstep.
 * Genuinely out of scope for this app's own stage timeline (see STAGES's
 * own note in lib/types.ts) — Shiprocket and Velocity are the two
 * fulfilment PLATFORMS DotConnects Logistics books this leg through, and once an
 * order is handed off, the real remaining tracking lives on THEIR page,
 * not ours.
 *
 * Neither platform has a publicly documented deep-link URL pattern that
 * embeds an AWB directly (both are form-based: paste the AWB in yourself)
 * — verified via research before writing this, specifically to avoid
 * fabricating a plausible-looking URL that 404s. courierTrackingUrl()
 * therefore links to the courier's own real tracking LANDING page; the AWB
 * itself is shown separately (with a copy button) for the customer to
 * paste in. Do not "upgrade" this to a query-string/path pattern without
 * first confirming it against the courier's own current documentation —
 * both are third-party sites that can and do change without notice.
 */

export type LastMileCourier = "Shiprocket" | "Velocity";

export const LAST_MILE_COURIERS: LastMileCourier[] = ["Shiprocket", "Velocity"];

const TRACKING_PAGE: Record<LastMileCourier, string> = {
  Shiprocket: "https://www.shiprocket.in/shipment-tracking/",
  Velocity: "https://www.velocityshipping.in/track",
};

export function courierTrackingUrl(courier: LastMileCourier | string | null | undefined): string | null {
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
