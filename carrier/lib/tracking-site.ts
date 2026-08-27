import { TRACKING_URL } from "@/lib/company";

/**
 * Where the tracking app lives.
 *
 * Tracking and admin moved out of this repo into the SvelteKit app on
 * track.dotconnectslogistics.com. This site is marketing only now, so every
 * "track an order" link is a CROSS-ORIGIN navigation rather than a
 * client-side route — hence plain <a> rather than next/link.
 *
 * Configurable so localhost and preview deploys can point somewhere
 * real. Falls back to the production subdomain.
 */
export const TRACKING_ORIGIN =
  process.env.NEXT_PUBLIC_TRACKING_ORIGIN ?? TRACKING_URL;

/** Tracking URL, optionally pre-filling the order id. */
export function trackingUrl(id?: string, phone?: string): string {
  if (!id) return TRACKING_ORIGIN;
  const params = new URLSearchParams({ id });
  if (phone) params.set("phone", phone);
  return `${TRACKING_ORIGIN}/?${params}`;
}
