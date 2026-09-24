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
