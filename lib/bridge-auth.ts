import { timingSafeEqual } from "crypto";

/**
 * Shared secret auth for Order Central bridge endpoints (app/api/admin/
 * orders/from-order-central/*) — Order Central is a Python script, not a
 * logged-in browser, so it can't carry the admin session cookie the way
 * the admin panel does. Was duplicated verbatim across two route files
 * before this; centralized so a future bridge endpoint doesn't need a
 * third copy.
 */
export function checkBridgeSecret(request: Request): boolean {
  const expected = process.env.ORDER_CENTRAL_BRIDGE_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-bridge-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
