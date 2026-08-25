/**
 * Tracking ID generator — architecture §5.5 (locked at Gate 5).
 *
 * Format: PREFIX + base36 timestamp + last 7 digits of the US order ID.
 * No separators. 18 characters, fixed until 2059.
 *
 * Example: USLMT6V291D0045868
 *          ───┬── ───┬─── ──┬────
 *             │      │      └─ last 7 digits of us_order_id
 *             │      └──────── Date.now().toString(36).toUpperCase()
 *             └─────────────── RMT or USL, chosen at random
 *
 * Prefix rule: RMT and USL carry no meaning. A replacement order
 * INHERITS its parent's prefix — so a customer never sees two
 * unexplained styles for the same purchase.
 *
 * NOT collision-proof by construction: two generations in the same
 * millisecond for the same US order produce an identical string.
 * Callers MUST retry on a unique-constraint violation (see
 * insertWithRetry below).
 */

const PREFIXES = ["RMT", "USL"] as const;
export type TrackingPrefix = (typeof PREFIXES)[number];

export function genTrackingId(
  usOrderId: string,
  parentPrefix?: TrackingPrefix,
): string {
  const prefix =
    parentPrefix ?? PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const ts = Date.now().toString(36).toUpperCase();
  const digits = usOrderId.replace(/\D/g, "").slice(-7).padStart(7, "0");
  return `${prefix}${ts}${digits}`;
}

/**
 * Extract the prefix from an existing tracking ID so a replacement
 * can inherit it.
 */
export function extractPrefix(trackingId: string): TrackingPrefix | undefined {
  const upper = trackingId.toUpperCase();
  for (const p of PREFIXES) {
    if (upper.startsWith(p)) return p;
  }
  return undefined;
}

/**
 * Maximum number of retry attempts when a unique-constraint violation
 * occurs on tracking_id. Each retry lands in a new millisecond, so
 * collisions resolve immediately — this cap is a safety net, not a
 * realistic expectation.
 */
export const TRACKING_ID_MAX_RETRIES = 3;
